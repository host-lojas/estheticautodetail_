// ================== SUPABASE CONFIG ==================
const SUPABASE_URL = 'https://sguptrpyiehizifuzgqw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNndXB0cnB5aWVoaXppZnV6Z3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTk4NTgsImV4cCI6MjA5OTE5NTg1OH0.1E4X1u5hwIWLHq5bCUTPIzIhwud8sI08IYYQb1OfBrI';

let supabaseClient;
let currentProducts = [];
let currentBrands = [];
let isLoggedIn = false;

// Session persistence + anti-bypass (re-check on reload + integrity token)
const SESSION_KEY = 'esthetic_admin_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function _sessionToken(loginTime) {
    // Simple integrity token (not cryptographic, but raises bar for casual console bypass)
    const seed = String(loginTime) + '|' + (navigator.userAgent || '').slice(0, 40);
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
        h = ((h << 5) - h) + seed.charCodeAt(i);
        h |= 0;
    }
    return 'e' + Math.abs(h).toString(36);
}

function saveSession() {
    const loginTime = Date.now();
    localStorage.setItem(SESSION_KEY, JSON.stringify({
        loggedIn: true,
        loginTime: loginTime,
        token: _sessionToken(loginTime)
    }));
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

function checkSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    try {
        const session = JSON.parse(raw);
        if (!session.loggedIn || !session.loginTime || !session.token) {
            clearSession();
            return false;
        }
        if (Date.now() - session.loginTime >= SESSION_MAX_AGE_MS) {
            clearSession();
            return false;
        }
        // Integrity check
        if (session.token !== _sessionToken(session.loginTime)) {
            clearSession();
            return false;
        }
        return true;
    } catch (e) {
        clearSession();
        return false;
    }
}

// Guard for protected actions - prevents easy bypass via console or devtools
function requireAuth() {
    // Double-check: both in-memory flag AND valid persisted session
    if (!isLoggedIn || !checkSession()) {
        isLoggedIn = false;
        alert('Sessão expirada ou acesso não autorizado. Faça login novamente.');
        logout();
        return false;
    }
    return true;
}

// Periodically re-validate session while dashboard is open
let _sessionWatchdog = null;
function startSessionWatchdog() {
    if (_sessionWatchdog) clearInterval(_sessionWatchdog);
    _sessionWatchdog = setInterval(() => {
        if (isLoggedIn && !checkSession()) {
            isLoggedIn = false;
            alert('Sessão expirada. Faça login novamente.');
            logout();
        }
    }, 60 * 1000); // a cada 1 minuto
}
function stopSessionWatchdog() {
    if (_sessionWatchdog) {
        clearInterval(_sessionWatchdog);
        _sessionWatchdog = null;
    }
}

function initSupabase() {
    if (!SUPABASE_URL.includes('SEU-PROJETO')) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.warn('%c[Admin] Usando modo demonstração (localStorage). Configure o Supabase!', 'color:#f59e0b');
    }
}

// ================== PASSWORD / AUTH ==================
async function checkPasswordExists() {
    if (!supabaseClient) {
        // Demo mode
        const savedPass = localStorage.getItem('esthetic_admin_password');
        return !!savedPass;
    }

    const { data, error } = await supabaseClient
        .from('admin_auth')
        .select('password')
        .limit(1)
        .single();

    return data && data.password;
}

async function setInitialPassword(password) {
    if (!supabaseClient) {
        localStorage.setItem('esthetic_admin_password', password);
        return true;
    }

    const { error } = await supabaseClient
        .from('admin_auth')
        .upsert({ id: 1, password: password, updated_at: new Date() });

    return !error;
}

async function verifyPassword(password) {
    if (!supabaseClient) {
        const saved = localStorage.getItem('esthetic_admin_password');
        return saved === password;
    }

    const { data, error } = await supabaseClient
        .from('admin_auth')
        .select('password')
        .limit(1)
        .single();

    return data && data.password === password;
}

async function handlePasswordSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('admin-password');
    const btn = document.getElementById('auth-btn');
    const hint = document.getElementById('auth-hint');
    const password = input.value.trim();

    if (!password) return;

    btn.disabled = true;
    btn.innerHTML = 'Verificando...';

    const exists = await checkPasswordExists();

    if (!exists) {
        // Primeira vez - definir senha
        const success = await setInitialPassword(password);
        if (success) {
            hint.innerHTML = '<span class="text-emerald-400">Senha criada com sucesso!</span>';
            setTimeout(() => {
                showDashboard();
            }, 800);
        } else {
            hint.innerHTML = '<span class="text-red-400">Erro ao salvar senha. Tente novamente.</span>';
            btn.disabled = false;
            btn.innerHTML = 'Criar Senha';
        }
    } else {
        // Verificar senha existente
        const valid = await verifyPassword(password);
        if (valid) {
            showDashboard();
        } else {
            hint.innerHTML = '<span class="text-red-400">Senha incorreta. Tente novamente.</span>';
            input.value = '';
            btn.disabled = false;
            btn.innerHTML = 'Entrar no Painel';
        }
    }
}

function showDashboard() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    isLoggedIn = true;
    saveSession();
    startSessionWatchdog();
    loadAdminProducts();
}

function logout() {
    stopSessionWatchdog();
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('admin-password').value = '';
    document.getElementById('auth-hint').innerHTML = '';
    isLoggedIn = false;
    clearSession();
}

// ================== PRODUCTS MANAGEMENT ==================
async function loadAdminProducts() {
    if (!isLoggedIn) {
        return;
    }
    const grid = document.getElementById('products-grid');
    if (grid) {
        grid.innerHTML = `<div class="products-grid-empty"><i class="fa-solid fa-spinner fa-spin"></i><p>Carregando produtos...</p></div>`;
    }

    try {
        if (!supabaseClient) {
            currentProducts = JSON.parse(localStorage.getItem('esthetic_products') || '[]');
        } else {
            const { data, error } = await supabaseClient
                .from('products')
                .select('*')
                .order('display_order', { ascending: true });

            if (error) throw error;
            currentProducts = data || [];
        }

        refreshBrandsList();
        renderAdminProducts();
        updateStats();
    } catch (err) {
        console.error(err);
        if (grid) {
            grid.innerHTML = `<div class="products-grid-empty text-red-400"><i class="fa-solid fa-exclamation-circle"></i><p>Erro ao carregar. Verifique Supabase.</p></div>`;
        }
    }
}

function getUniqueBrands() {
    const brands = new Set();
    currentProducts.forEach(p => {
        if (p.brand && p.brand.trim() !== '') {
            brands.add(p.brand.trim());
        }
    });
    return Array.from(brands).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function refreshBrandsList() {
    currentBrands = getUniqueBrands();
}

function populateBrandSelect(selectedBrand = '') {
    const select = document.getElementById('product-brand-select');
    const newInput = document.getElementById('product-brand-new');
    if (!select) return;

    select.innerHTML = '';
    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.textContent = 'Sem marca';
    select.appendChild(optNone);

    currentBrands.forEach(brand => {
        const opt = document.createElement('option');
        opt.value = brand;
        opt.textContent = brand;
        select.appendChild(opt);
    });

    const optNew = document.createElement('option');
    optNew.value = '__new__';
    optNew.textContent = '+ Criar nova marca...';
    select.appendChild(optNew);

    if (selectedBrand && currentBrands.includes(selectedBrand)) {
        select.value = selectedBrand;
        newInput.classList.add('hidden');
        newInput.value = '';
    } else if (selectedBrand) {
        select.value = '__new__';
        newInput.classList.remove('hidden');
        newInput.value = selectedBrand;
    } else {
        select.value = '';
        newInput.classList.add('hidden');
        newInput.value = '';
    }
}

function handleBrandSelectChange() {
    const select = document.getElementById('product-brand-select');
    const newInput = document.getElementById('product-brand-new');
    if (select.value === '__new__') {
        newInput.classList.remove('hidden');
        newInput.focus();
    } else {
        newInput.classList.add('hidden');
        newInput.value = '';
    }
}

function getSelectedBrand() {
    const select = document.getElementById('product-brand-select');
    const newInput = document.getElementById('product-brand-new');
    if (select.value === '__new__') {
        return (newInput.value || '').trim() || null;
    }
    return select.value || null;
}

function renderAdminProducts() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (currentProducts.length === 0) {
        grid.innerHTML = `
            <div class="products-grid-empty">
                <i class="fa-solid fa-boxes"></i>
                <p>Nenhum produto cadastrado ainda.</p>
                <button onclick="showAddProductModal()" class="mt-4 text-[#ff6a00] text-sm underline">Adicionar o primeiro produto</button>
            </div>`;
        document.getElementById('product-count').textContent = `(0)`;
        return;
    }

    currentProducts.forEach((product) => {
        const hasPrice = product.price && product.price > 0;
        const hasDiscount = product.discount_price && product.discount_price > 0;

        const card = document.createElement('div');
        card.className = `product-card ${!product.active ? 'inactive' : ''}`;
        card.dataset.id = product.id;

        const imageHtml = product.image_url
            ? `<img src="${product.image_url}" alt="${(product.name || '').replace(/"/g, '&quot;')}" loading="lazy">`
            : `<div class="no-image"><i class="fa-solid fa-image"></i></div>`;

        let pricesHtml = '';
        if (hasDiscount && hasPrice) {
            pricesHtml = `
                <span class="card-price-discount">R$ ${product.discount_price.toFixed(2).replace('.', ',')}</span>
                <span class="card-price-old">R$ ${product.price.toFixed(2).replace('.', ',')}</span>`;
        } else if (hasDiscount) {
            pricesHtml = `<span class="card-price-discount">R$ ${product.discount_price.toFixed(2).replace('.', ',')}</span>`;
        } else if (hasPrice) {
            pricesHtml = `<span class="card-price">R$ ${product.price.toFixed(2).replace('.', ',')}</span>`;
        } else {
            pricesHtml = `<span class="card-price" style="color:rgba(255,255,255,0.35)">—</span>`;
        }

        card.innerHTML = `
            <div class="card-drag-handle" title="Arraste para reordenar">
                <i class="fa-solid fa-grip-vertical"></i>
            </div>
            <div class="card-image">
                ${imageHtml}
            </div>
            <div class="card-body">
                <div class="card-name">${product.name || 'Sem nome'}</div>
                <div class="card-brand">${product.brand || 'Sem marca'}</div>
                <div class="card-prices">${pricesHtml}</div>
            </div>
            <div class="card-footer">
                <span class="card-status ${product.active ? 'active' : 'inactive'}">
                    ${product.active ? 'Ativo' : 'Inativo'}
                </span>
                <div class="card-actions">
                    <button type="button" onclick="editProduct(${product.id})" title="Editar">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button type="button" onclick="toggleActive(${product.id}, ${!product.active})" title="${product.active ? 'Desativar' : 'Ativar'}">
                        <i class="fa-solid fa-power-off"></i>
                    </button>
                    <button type="button" class="delete" onclick="deleteProduct(${product.id})" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    // SortableJS otimizado para desktop e mobile (touch)
    if (window.Sortable) {
        // Destroy previous instance if any
        if (grid._sortable) {
            try { grid._sortable.destroy(); } catch (e) {}
        }
        grid._sortable = new Sortable(grid, {
            handle: '.card-drag-handle',
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            forceFallback: false,
            fallbackOnBody: true,
            swapThreshold: 0.65,
            delay: 80,                 // pequeno delay evita conflito com scroll no mobile
            delayOnTouchOnly: true,
            touchStartThreshold: 5,
            onEnd: async function () {
                await updateProductOrder();
            }
        });
    }

    document.getElementById('product-count').textContent = `(${currentProducts.length})`;
}

async function updateProductOrder() {
    if (!requireAuth()) return;
    const cards = document.querySelectorAll('#products-grid .product-card');
    const newOrder = [];

    cards.forEach((card, index) => {
        const id = parseInt(card.dataset.id);
        newOrder.push({ id, display_order: index });
    });

    try {
        if (!supabaseClient) {
            currentProducts.forEach(p => {
                const found = newOrder.find(o => o.id === p.id);
                if (found) p.display_order = found.display_order;
            });
            currentProducts.sort((a, b) => {
                const oa = newOrder.find(o => o.id === a.id)?.display_order ?? 0;
                const ob = newOrder.find(o => o.id === b.id)?.display_order ?? 0;
                return oa - ob;
            });
            localStorage.setItem('esthetic_products', JSON.stringify(currentProducts));
        } else {
            for (const item of newOrder) {
                await supabaseClient.from('products').update({ display_order: item.display_order }).eq('id', item.id);
            }
        }
    } catch (e) {
        console.error('Erro ao salvar ordem:', e);
        alert('Erro ao salvar a nova ordem. Recarregue a página.');
        await loadAdminProducts();
    }
}

function updateStats() {
    const total = currentProducts.length;
    const active = currentProducts.filter(p => p.active).length;

    const uniqueBrands = new Set(
        currentProducts
            .map(p => p.brand)
            .filter(brand => brand && brand.trim() !== '')
    );

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-active').textContent = active;
    document.getElementById('stat-brands').textContent = uniqueBrands.size;
    document.getElementById('last-update').textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
// ================== IMAGE PREVIEW ==================
let previewObjectUrl = null; // para revogar blob URLs e evitar memory leak

function setImagePreview(src) {
    const img = document.getElementById('image-preview');
    const placeholder = document.getElementById('image-placeholder');
    const box = document.getElementById('image-preview-box');
    const clearBtn = document.getElementById('clear-image-btn');

    if (src) {
        img.src = src;
        img.classList.remove('hidden');
        placeholder.classList.add('hidden');
        box.classList.add('has-image');
        clearBtn.classList.remove('hidden');
    } else {
        img.src = '';
        img.classList.add('hidden');
        placeholder.classList.remove('hidden');
        box.classList.remove('has-image');
        clearBtn.classList.add('hidden');
    }
}

function revokePreviewUrl() {
    if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
    }
}

function previewProductImage(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    // Só aceita imagem
    if (!file.type.startsWith('image/')) {
        alert('Selecione um arquivo de imagem (JPG, PNG, WebP...).');
        event.target.value = '';
        return;
    }

    revokePreviewUrl();
    previewObjectUrl = URL.createObjectURL(file);
    setImagePreview(previewObjectUrl);

    // Limpa o campo URL para priorizar o arquivo
    document.getElementById('product-image-url').value = '';
}

function previewImageFromUrl(url) {
    const trimmed = (url || '').trim();
    // Se há arquivo selecionado, não sobrescreve o preview com URL
    const fileInput = document.getElementById('product-image-file');
    if (fileInput.files && fileInput.files.length > 0) return;

    revokePreviewUrl();
    if (trimmed) {
        setImagePreview(trimmed);
    } else {
        setImagePreview(null);
    }
}

function clearImagePreview() {
    revokePreviewUrl();
    setImagePreview(null);
    document.getElementById('product-image-file').value = '';
    document.getElementById('product-image-url').value = '';
}

function showAddProductModal() {
    document.getElementById('modal-title').textContent = 'Novo Produto';
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    document.getElementById('product-active').checked = true;
    clearImagePreview();
    refreshBrandsList();
    populateBrandSelect('');
    document.getElementById('product-modal').classList.remove('hidden');
    document.getElementById('product-modal').classList.add('flex');
}

function editProduct(id) {
    const product = currentProducts.find(p => p.id === id);
    if (!product) return;

    document.getElementById('modal-title').textContent = 'Editar Produto';
    document.getElementById('product-id').value = product.id;
    document.getElementById('product-name').value = product.name || '';
    document.getElementById('product-category').value = product.category || 'produto';
    document.getElementById('product-price').value = product.price || '';
    document.getElementById('product-discount').value = product.discount_price || '';
    document.getElementById('product-description').value = product.description || '';
    document.getElementById('product-image-url').value = product.image_url || '';
    // Limpa o input de arquivo ao editar
    document.getElementById('product-image-file').value = '';
    document.getElementById('product-active').checked = product.active !== false;

    // Popula select de marcas com a marca atual do produto
    refreshBrandsList();
    populateBrandSelect(product.brand || '');

    // Mostra preview da imagem já salva (se houver)
    revokePreviewUrl();
    if (product.image_url) {
        setImagePreview(product.image_url);
    } else {
        setImagePreview(null);
    }

    document.getElementById('product-modal').classList.remove('hidden');
    document.getElementById('product-modal').classList.add('flex');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.remove('flex');
    document.getElementById('product-modal').classList.add('hidden');
    revokePreviewUrl();
}

// Função auxiliar para fazer upload de imagem no Supabase Storage
async function uploadProductImage(file) {
    if (!supabaseClient) {
        // Em modo demo, usamos URL temporária (não persistente)
        return URL.createObjectURL(file);
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data, error } = await supabaseClient.storage
        .from('product-images')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        console.error('Erro no upload:', error);
        throw new Error('Falha ao enviar imagem. Verifique o bucket no Supabase.');
    }

    const { data: urlData } = supabaseClient.storage
        .from('product-images')
        .getPublicUrl(fileName);

    return urlData.publicUrl;
}

async function saveProduct(e) {
    e.preventDefault();
    if (!requireAuth()) return;

    const id = document.getElementById('product-id').value;
    const isEdit = !!id;

    const fileInput = document.getElementById('product-image-file');
    const urlInput = document.getElementById('product-image-url');

    let finalImageUrl = urlInput.value.trim() || null;

    // Se o usuário selecionou um arquivo, faz upload primeiro
    if (fileInput.files.length > 0) {
        try {
            const uploadedUrl = await uploadProductImage(fileInput.files[0]);
            finalImageUrl = uploadedUrl;
        } catch (uploadError) {
            alert('Erro ao enviar a imagem: ' + uploadError.message);
            return;
        }
    }

    const productData = {
        name: document.getElementById('product-name').value.trim(),
        brand: getSelectedBrand(),
        category: document.getElementById('product-category').value,
        price: parseFloat(document.getElementById('product-price').value) || null,
        discount_price: parseFloat(document.getElementById('product-discount').value) || null,
        description: document.getElementById('product-description').value.trim() || null,
        image_url: finalImageUrl,
        active: document.getElementById('product-active').checked,
        display_order: isEdit ? undefined : currentProducts.length
    };

    try {
        if (!supabaseClient) {
            // Demo mode
            if (isEdit) {
                const idx = currentProducts.findIndex(p => p.id == id);
                currentProducts[idx] = { ...currentProducts[idx], ...productData };
            } else {
                productData.id = Date.now();
                currentProducts.push(productData);
            }
            localStorage.setItem('esthetic_products', JSON.stringify(currentProducts));
        } else {
            if (isEdit) {
                await supabaseClient.from('products').update(productData).eq('id', id);
            } else {
                await supabaseClient.from('products').insert([productData]);
            }
        }

        closeProductModal();
        await loadAdminProducts();

    } catch (err) {
        console.error(err);
        alert('Erro ao salvar produto. Verifique o console.');
    }
}

async function toggleActive(id, newStatus) {
    if (!requireAuth()) return;
    try {
        if (!supabaseClient) {
            const idx = currentProducts.findIndex(p => p.id == id);
            currentProducts[idx].active = newStatus;
            localStorage.setItem('esthetic_products', JSON.stringify(currentProducts));
        } else {
            await supabaseClient.from('products').update({ active: newStatus }).eq('id', id);
        }
        await loadAdminProducts();
    } catch (e) {
        alert('Erro ao alterar status.');
    }
}

async function deleteProduct(id) {
    if (!requireAuth()) return;
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
        if (!supabaseClient) {
            // Modo demonstração (localStorage)
            currentProducts = currentProducts.filter(p => p.id != id);
            localStorage.setItem('esthetic_products', JSON.stringify(currentProducts));
        } else {
            // 1. Buscar o produto para pegar a image_url
            const { data: product, error: fetchError } = await supabaseClient
                .from('products')
                .select('image_url')
                .eq('id', id)
                .single();

            if (fetchError) throw fetchError;

            // 2. Se tiver imagem no Storage, deletar o arquivo
            if (product && product.image_url) {
                try {
                    // Extrai o nome do arquivo da URL do Supabase Storage
                    const urlParts = product.image_url.split('/product-images/');
                    if (urlParts.length > 1) {
                        const fileName = urlParts[1].split('?')[0];
                        await supabaseClient.storage
                            .from('product-images')
                            .remove([fileName]);
                    }
                } catch (storageError) {
                    console.warn('Não foi possível deletar a imagem do Storage:', storageError);
                    // Continua mesmo se der erro ao deletar a imagem
                }
            }

            // 3. Deletar o registro do banco de dados
            const { error: deleteError } = await supabaseClient
                .from('products')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;
        }

        await loadAdminProducts();
    } catch (e) {
        console.error(e);
        alert('Erro ao excluir produto.');
    }
}

// ================== BACKUP / IMPORT / BULK DELETE ==================

/**
 * Exporta todos os produtos atuais como arquivo JSON auto-contido.
 * Tenta embutir imagens como base64 (data URL) para que o backup seja funcional
 * mesmo em outro ambiente/supabase (quando possível).
 */
async function exportBackup() {
    if (!requireAuth()) return;

    if (currentProducts.length === 0) {
        alert('Nenhum produto cadastrado para exportar.');
        return;
    }

    const btns = document.querySelectorAll('button[onclick*="exportBackup"]');
    if (btns.length) btns[0].disabled = true;

    try {
        const backupData = {
            version: "1.0",
            exported_at: new Date().toISOString(),
            source: "Esthetic Admin - Esthetic Produtos",
            total_products: currentProducts.length,
            products: []
        };

        for (const product of currentProducts) {
            let exportProduct = { ...product };

            // Tenta embutir imagem como base64 para backup portátil
            if (product.image_url &&
                !product.image_url.startsWith('data:') &&
                !product.image_url.startsWith('blob:')) {
                try {
                    const resp = await fetch(product.image_url, { mode: 'cors' });
                    if (resp.ok) {
                        const blob = await resp.blob();
                        const base64 = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                        exportProduct.image_url = base64;
                        exportProduct._embedded_image = true;
                    }
                } catch (imgErr) {
                    console.warn(`[Backup] Não foi possível embutir imagem de "${product.name}":`, imgErr);
                    // Mantém URL original (funciona se for mesmo projeto Supabase)
                }
            }
            backupData.products.push(exportProduct);
        }

        const json = JSON.stringify(backupData, null, 2);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `esthetic-produtos-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Feedback sutil
        const originalText = btns.length ? btns[0].innerHTML : '';
        if (btns.length) {
            btns[0].innerHTML = '<i class="fa-solid fa-check"></i> Backup baixado!';
            setTimeout(() => {
                if (btns[0]) btns[0].innerHTML = originalText;
                btns[0].disabled = false;
            }, 2200);
        } else {
            alert('Backup exportado com sucesso! O arquivo contém os dados e imagens embutidas (quando possível).');
        }
    } catch (err) {
        console.error('[Backup] Erro ao exportar:', err);
        alert('Erro ao gerar backup: ' + err.message);
        if (btns.length) btns[0].disabled = false;
    }
}

/**
 * Importa um arquivo .json de backup, substituindo o catálogo atual.
 * Lida com imagens em base64 convertendo para upload no Storage (Supabase) ou mantendo data: (demo).
 */
async function importBackup(e) {
    if (!requireAuth()) {
        e.target.value = '';
        return;
    }

    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // reset input sempre

    if (!file) return;

    if (!confirm('⚠️ IMPORTAR BACKUP\n\nIsso irá SUBSTITUIR completamente todos os produtos atuais pelos do arquivo.\nImagens serão restauradas quando possível.\n\nDeseja continuar?')) {
        return;
    }

    try {
        const text = await file.text();
        const backup = JSON.parse(text);

        if (!backup || !Array.isArray(backup.products)) {
            throw new Error('Arquivo inválido. Não contém lista de produtos.');
        }

        // Prepara produtos (remove ids antigos, ajusta imagens)
        const productsToImport = [];
        for (const p of backup.products) {
            let prod = { ...p };
            delete prod.id;
            delete prod._embedded_image;

            // Se imagem é data URL (base64 do backup), processa
            if (prod.image_url && prod.image_url.startsWith('data:')) {
                if (supabaseClient) {
                    try {
                        // Converte dataURL -> Blob -> upload Storage
                        const fetchRes = await fetch(prod.image_url);
                        const blob = await fetchRes.blob();
                        const ext = (blob.type.split('/')[1] || 'jpg').split('+')[0];
                        const fileName = `backup-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

                        const { data: upData, error: upErr } = await supabaseClient.storage
                            .from('product-images')
                            .upload(fileName, blob, { cacheControl: '3600', upsert: false });

                        if (upErr) throw upErr;

                        const { data: pub } = supabaseClient.storage
                            .from('product-images')
                            .getPublicUrl(fileName);

                        prod.image_url = pub.publicUrl;
                    } catch (convErr) {
                        console.warn('[Import] Falha ao converter imagem base64 para Storage, mantendo data URL temporária:', convErr);
                        // Mantém data: — vai funcionar visualmente mas não é persistente ideal
                    }
                }
                // else: demo mode → mantém data: URL (funciona enquanto página aberta)
            }

            // Defaults seguros
            if (typeof prod.active === 'undefined') prod.active = true;
            if (typeof prod.display_order === 'undefined') prod.display_order = productsToImport.length;
            if (!prod.category) prod.category = 'produto';

            productsToImport.push(prod);
        }

        // Substitui catálogo atual
        if (!supabaseClient) {
            // Demo / localStorage
            currentProducts = productsToImport.map((p, idx) => ({
                ...p,
                id: Date.now() + idx
            }));
            localStorage.setItem('esthetic_products', JSON.stringify(currentProducts));
        } else {
            // Supabase: limpa tudo primeiro (imagens + registros)
            await clearAllProductsForImport();

            // Insere os novos (preservando ordem do backup via display_order)
            for (const prod of productsToImport) {
                const insertPayload = { ...prod };
                delete insertPayload.id; // deixa o banco gerar
                const { error: insErr } = await supabaseClient.from('products').insert([insertPayload]);
                if (insErr) throw insErr;
            }
        }

        await loadAdminProducts();
        alert(`✅ Backup importado com sucesso!\n${productsToImport.length} produto(s) restaurado(s).`);

    } catch (err) {
        console.error('[Import] Erro:', err);
        alert('Falha ao importar backup: ' + (err.message || err));
    }
}

/** Helper interno para limpar todos os produtos + imagens (usado por import e deleteAll) */
async function clearAllProductsForImport() {
    if (!supabaseClient) {
        localStorage.removeItem('esthetic_products');
        currentProducts = [];
        return;
    }

    // Busca todos para deletar imagens
    const { data: allProds, error: fErr } = await supabaseClient
        .from('products')
        .select('id, image_url');

    if (fErr) throw fErr;

    const toRemove = [];
    (allProds || []).forEach(p => {
        if (p.image_url) {
            try {
                const parts = p.image_url.split('/product-images/');
                if (parts.length > 1) {
                    toRemove.push(parts[1].split('?')[0]);
                }
            } catch (_) { /* ignore */ }
        }
    });

    if (toRemove.length > 0) {
        try {
            await supabaseClient.storage.from('product-images').remove(toRemove);
        } catch (sErr) {
            console.warn('Algumas imagens não puderam ser removidas do Storage:', sErr);
        }
    }

    const ids = (allProds || []).map(p => p.id);
    if (ids.length > 0) {
        const { error: dErr } = await supabaseClient.from('products').delete().in('id', ids);
        if (dErr) throw dErr;
    }
}

/**
 * Exclui TODOS os produtos com dupla confirmação forte.
 */
async function deleteAllProducts() {
    if (!requireAuth()) return;

    // Primeira confirmação
    if (!confirm('⚠️ EXCLUIR TODOS OS PRODUTOS\n\nEsta ação removerá permanentemente TODOS os produtos do catálogo e suas imagens do armazenamento.\n\nTem certeza que deseja continuar?')) {
        return;
    }

    // Segunda confirmação via digitação (mais segura que só "OK")
    const typed = prompt('CONFIRMAÇÃO FINAL\n\nPara prosseguir com a exclusão irreversível, digite exatamente:\n\nEXCLUIR TUDO\n\n(Cancelar se não tiver certeza absoluta)');
    if (typed !== 'EXCLUIR TUDO') {
        alert('Confirmação incorreta ou cancelada. Nenhum produto foi excluído.');
        return;
    }

    try {
        if (!supabaseClient) {
            localStorage.removeItem('esthetic_products');
            currentProducts = [];
        } else {
            await clearAllProductsForImport();
        }

        await loadAdminProducts();
        alert('✅ Todos os produtos foram excluídos permanentemente.');
    } catch (err) {
        console.error('[DeleteAll] Erro:', err);
        alert('Ocorreu um erro ao excluir todos os produtos: ' + (err.message || err));
    }
}

function switchTab(tab) {
    // Esconde todos
    document.getElementById('tab-content-products').classList.add('hidden');
    document.getElementById('tab-content-brands').classList.add('hidden');
    document.getElementById('tab-content-preview').classList.add('hidden');

    // Remove active de todos
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active', 'border-b-2', 'border-[#ff6a00]', 'text-[#ff6a00]'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.add('text-white/60'));

    if (tab === 'products') {
        document.getElementById('tab-content-products').classList.remove('hidden');
        document.getElementById('tab-products').classList.add('active', 'border-b-2', 'border-[#ff6a00]', 'text-[#ff6a00]');
        document.getElementById('tab-products').classList.remove('text-white/60');
    } else if (tab === 'brands') {
        document.getElementById('tab-content-brands').classList.remove('hidden');
        // Nota: botão de aba de marcas não existe no HTML atual (legado). Evita erro:
        const brandsBtn = document.getElementById('tab-brands');
        if (brandsBtn) {
            brandsBtn.classList.add('active', 'border-b-2', 'border-[#ff6a00]', 'text-[#ff6a00]');
            brandsBtn.classList.remove('text-white/60');
        }
    } else if (tab === 'preview') {
        document.getElementById('tab-content-preview').classList.remove('hidden');
        document.getElementById('tab-preview').classList.add('active', 'border-b-2', 'border-[#ff6a00]', 'text-[#ff6a00]');
        document.getElementById('tab-preview').classList.remove('text-white/60');
    }
}

// Init Admin
async function initAdmin() {
    initSupabase();

    // Auto-login if valid recent session exists (improves UX and reduces repeated logins)
    if (checkSession()) {
        isLoggedIn = true;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        startSessionWatchdog();
        loadAdminProducts();
        console.log('%c[Esthetic Admin] Sessão restaurada automaticamente', 'color:#22c55e');
        return;
    }

    const exists = await checkPasswordExists();
    const hint = document.getElementById('auth-hint');

    if (!exists) {
        hint.innerHTML = 'Primeiro acesso: defina uma senha de administrador';
        document.getElementById('auth-btn').textContent = 'Criar Senha e Entrar';
    } else {
        hint.innerHTML = 'Digite sua senha para continuar';
    }

    // Enter key support already handled by form
    console.log('%c[Esthetic Admin] Painel carregado', 'color:#555');
}

window.onload = initAdmin;