// ================== CONFIGURAÇÃO SUPABASE ==================
// SUBSTITUA PELOS SEUS DADOS DO SUPABASE
const SUPABASE_URL = 'https://sguptrpyiehizifuzgqw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNndXB0cnB5aWVoaXppZnV6Z3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTk4NTgsImV4cCI6MjA5OTE5NTg1OH0.1E4X1u5hwIWLHq5bCUTPIzIhwud8sI08IYYQb1OfBrI';

let supabaseClient;
let products = [];
let cart = JSON.parse(localStorage.getItem('esthetic_cart') || '[]');

// Variáveis do modal de produto
let currentProductId = null;
let modalQuantity = 1;

function initSupabase() {
    if (SUPABASE_URL.includes('SEU-PROJETO')) {
        console.warn('%c[Esthetic] Usando modo demonstração (localStorage)', 'color:#f59e0b');

        // Tenta carregar produtos salvos pelo admin no localStorage (mesma chave)
        const savedProducts = localStorage.getItem('esthetic_products');

        if (savedProducts) {
            try {
                products = JSON.parse(savedProducts).filter(p => p.active !== false);
                renderProducts(products);
                populateFilters();
            } catch (e) {
                console.error('Erro ao ler produtos do localStorage', e);
                products = [];
                renderProducts(products);
            }
        } else {
            // Se não tiver nada salvo ainda, começa vazio (sem produtos demo)
            products = [];
            renderProducts(products);
            document.getElementById('empty-state').classList.remove('hidden');
        }
        return;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    loadProducts();
    setupRealtime(); // ← Realtime ativado
}

// ================== REALTIME ==================
function setupRealtime() {
    if (!supabaseClient) return;

    supabaseClient
        .channel('products-realtime')
        .on(
            'postgres_changes',
            {
                event: '*',              // INSERT, UPDATE e DELETE
                schema: 'public',
                table: 'products'
            },
            (payload) => {
                console.log('[Realtime] Mudança detectada:', payload.eventType, payload);
                // Recarrega a lista completa (simples e confiável)
                loadProducts();
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('%c[Realtime] Escutando mudanças na tabela products', 'color:#22c55e');
            }
        });
}

async function loadProducts() {
    try {
        const { data, error } = await supabaseClient
            .from('products')
            .select('*')
            .eq('active', true)
            .order('display_order', { ascending: true });

        if (error) throw error;
        products = data || [];
        renderProducts(products);
        populateFilters();
    } catch (err) {
        console.error('Erro ao carregar produtos:', err);
        document.getElementById('products-grid').innerHTML =
            `<div class="col-span-full text-center py-10 text-red-400">Erro ao carregar produtos. Verifique o Supabase.</div>`;
    }
}

function loadDemoProducts() {
    // Apenas para demonstração quando Supabase não está configurado
    products = [
        {
            id: 1, name: "Vonixx Luster Cera Limpadora Spray 500ml", brand: "Vonixx",
            price: 45.90, discount_price: 43.61, description: "Cera de alta performance com proteção UV.",
            image_url: "https://picsum.photos/id/1015/300/300", category: "produto", active: true, display_order: 1
        },
        {
            id: 2, name: "Zacs Zyon Limpador Automotivo 500ml", brand: "Zacs",
            price: 24.90, discount_price: 23.66, description: "",
            image_url: "https://picsum.photos/id/1060/300/300", category: "produto", active: true, display_order: 2
        }
    ];
    renderProducts(products);
    populateFilters();
}

function renderProducts(filteredProducts) {
    const grid = document.getElementById('products-grid');
    const empty = document.getElementById('empty-state');
    grid.innerHTML = '';
    empty.classList.add('hidden');

    if (!filteredProducts || filteredProducts.length === 0) {
        empty.classList.remove('hidden');
        return;
    }

    filteredProducts.forEach(product => {
        const hasDiscount = product.discount_price && product.discount_price < product.price;
        const finalPrice = hasDiscount ? product.discount_price : product.price;

        const card = document.createElement('div');
        card.className = `product-card rounded-3xl overflow-hidden flex flex-col cursor-pointer`;
        card.innerHTML = `
            <div class="relative aspect-square bg-[#1a1a1a] flex items-center justify-center overflow-hidden">
                <img src="${product.image_url || 'https://picsum.photos/id/1018/300/300'}" 
                     class="w-full h-full object-cover" alt="${product.name}">
                ${hasDiscount ? `
                    <div class="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-full tracking-wider">DESCONTO PIX</div>
                ` : ''}
            </div>
            
            <div class="p-5 flex flex-col flex-1">
                <div class="flex items-center gap-x-2 mb-2">
                    <span class="text-[10px] uppercase tracking-[1.5px] text-white/50 font-medium">${product.brand || 'Esthetic'}</span>
                </div>
                
                <h3 class="font-semibold leading-tight mb-3 line-clamp-2 flex-1">${product.name}</h3>
                
                ${product.description ? `<p class="text-xs text-white/60 line-clamp-2 mb-4">${product.description}</p>` : ''}
                
                <div class="mt-auto">
                    ${product.price ? `
                        <div class="flex items-baseline gap-x-2">
                            <span class="price">R$ ${finalPrice.toFixed(2).replace('.', ',')}</span>
                            ${hasDiscount ? `<span class="pix-price line-through">R$ ${product.price.toFixed(2).replace('.', ',')}</span>` : ''}
                        </div>
                        ${hasDiscount ? `<div class="text-[10px] text-red-400 font-medium">ou R$ ${product.discount_price.toFixed(2).replace('.', ',')} no Pix</div>` : ''}
                    ` : '<div class="text-sm text-white/50 italic">Consulte preço</div>'}
                    
                    <button onclick="addToCart(${product.id}, event)"
                            class="mt-4 w-full py-3 text-sm font-semibold rounded-2xl border border-white/30 hover:bg-white hover:text-[#0d0d0f] active:scale-[0.985] transition-all flex items-center justify-center gap-x-2">
                        <i class="fa-solid fa-cart-plus"></i>
                        <span>Adicionar ao carrinho</span>
                    </button>
                </div>
            </div>
        `;

        // Torna o card clicável para abrir o modal de detalhes (exceto no botão de adicionar)
        card.addEventListener('click', function(ev) {
            if (ev.target.closest('button')) {
                return; // Deixa o botão tratar o clique
            }
            showProductModal(product.id);
        });

        grid.appendChild(card);
    });

    document.getElementById('results-count').textContent = `${filteredProducts.length} produtos`;
}

function populateFilters() {
    const brandSelect = document.getElementById('brand-filter');
    const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];

    brandSelect.innerHTML = '<option value="">Todas as marcas</option>';
    brands.forEach(brand => {
        const opt = document.createElement('option');
        opt.value = brand;
        opt.textContent = brand;
        brandSelect.appendChild(opt);
    });
}

function filterProducts() {
    const search = document.getElementById('search-input').value.toLowerCase().trim();
    const brand = document.getElementById('brand-filter').value;
    const category = document.getElementById('category-filter').value;

    let filtered = products;

    if (search) {
        filtered = filtered.filter(p =>
            p.name.toLowerCase().includes(search) ||
            (p.brand && p.brand.toLowerCase().includes(search)) ||
            (p.description && p.description.toLowerCase().includes(search))
        );
    }
    if (brand) filtered = filtered.filter(p => p.brand === brand);
    if (category) filtered = filtered.filter(p => p.category === category);

    renderProducts(filtered);
}

// ================== CARRINHO ==================
function updateCartCount() {
    const countEl = document.getElementById('cart-count');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    countEl.textContent = totalItems;
    countEl.style.display = totalItems > 0 ? 'flex' : 'none';
}

function addToCart(productId, e = null, quantityToAdd = 1) {
    // Evita propagação apenas se veio de evento de clique no botão do card
    if (e && e.stopImmediatePropagation) {
        e.stopImmediatePropagation();
    }

    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.findIndex(item => item.id === productId);

    if (existing > -1) {
        cart[existing].quantity += quantityToAdd;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.discount_price || product.price || 0,
            quantity: quantityToAdd
        });
    }

    localStorage.setItem('esthetic_cart', JSON.stringify(cart));
    updateCartCount();

    // Feedback visual no botão (apenas quando adicionado pelo botão do card)
    if (e) {
        const btn = e.currentTarget || (e.target && e.target.closest('button'));
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = `<i class="fa-solid fa-check"></i> Adicionado!`;
            setTimeout(() => {
                if (btn && btn.parentNode) btn.innerHTML = originalText;
            }, 1200);
        }
    }

    // Abrir carrinho automaticamente apenas na primeira adição (e se não vier do modal)
    if (cart.length === quantityToAdd && !e) {
        // Se veio do modal (sem e), não abre automaticamente para não atrapalhar
    } else if (cart.length === 1 && e) {
        setTimeout(openCart, 600);
    }
}

function openCart() {
    const modal = document.getElementById('cart-modal');
    const itemsContainer = document.getElementById('cart-items');
    itemsContainer.innerHTML = '';

    if (cart.length === 0) {
        itemsContainer.innerHTML = `
            <div class="text-center py-12">
                <i class="fa-solid fa-shopping-cart text-5xl text-white/20 mb-4"></i>
                <p class="text-white/60">Seu carrinho está vazio</p>
            </div>`;
        document.getElementById('cart-total').textContent = 'R$ 0,00';
    } else {
        let total = 0;
        cart.forEach((item, index) => {
            total += item.price * item.quantity;

            const div = document.createElement('div');
            div.className = 'flex gap-x-4 border-b border-white/10 pb-4';
            div.innerHTML = `
                <div class="flex-1 min-w-0">
                    <div class="font-medium leading-tight pr-4">${item.name}</div>
                    <div class="text-[#ff6a00] font-semibold mt-1">R$ ${item.price.toFixed(2).replace('.', ',')}</div>
                </div>
                <div class="flex flex-col items-end justify-between">
                    <button onclick="removeFromCart(${index})" class="text-red-400 hover:text-red-500 text-xs">remover</button>
                    
                    <div class="flex items-center gap-x-3 mt-auto">
                        <button onclick="changeQuantity(${index}, -1)" class="w-7 h-7 flex items-center justify-center border border-white/30 rounded-lg active:bg-white/10">-</button>
                        <span class="font-mono w-6 text-center">${item.quantity}</span>
                        <button onclick="changeQuantity(${index}, 1)" class="w-7 h-7 flex items-center justify-center border border-white/30 rounded-lg active:bg-white/10">+</button>
                    </div>
                </div>
            `;
            itemsContainer.appendChild(div);
        });
        document.getElementById('cart-total').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function changeQuantity(index, delta) {
    cart[index].quantity += delta;
    if (cart[index].quantity < 1) cart[index].quantity = 1;
    localStorage.setItem('esthetic_cart', JSON.stringify(cart));
    openCart(); // refresh modal
    updateCartCount();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('esthetic_cart', JSON.stringify(cart));
    openCart();
    updateCartCount();
}

function closeCart() {
    const modal = document.getElementById('cart-modal');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
}

function checkout() {
    closeCart();
    document.getElementById('checkout-modal').classList.remove('hidden');
    document.getElementById('checkout-modal').classList.add('flex');
}

function closeCheckout() {
    const modal = document.getElementById('checkout-modal');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
}

function submitOrder(e) {
    e.preventDefault();

    const name = document.getElementById('customer-name').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const payment = document.getElementById('payment-method').value;

    if (!name || !phone) {
        alert("Por favor preencha nome e WhatsApp.");
        return;
    }

    let message = `Olá! Gostaria de fazer um pedido na *Esthetic Auto Detail*.\n\n`;
    message += `*Nome:* ${name}\n`;
    message += `*WhatsApp:* ${phone}\n`;
    message += `*Forma de Pagamento:* ${payment}\n\n`;
    message += `*PRODUTOS:*\n`;

    let total = 0;
    cart.forEach(item => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        message += `• ${item.quantity}x ${item.name} — R$ ${subtotal.toFixed(2).replace('.', ',')}\n`;
    });

    message += `\n*TOTAL: R$ ${total.toFixed(2).replace('.', ',')}*\n\n`;
    message += `Aguardo confirmação e dados para pagamento. Obrigado!`;

    const encoded = encodeURIComponent(message);
    const whatsappNumber = '5581981749601'; // WhatsApp da loja

    window.open(`https://wa.me/${whatsappNumber}?text=${encoded}`, '_blank');

    // Limpar carrinho após envio
    cart = [];
    localStorage.setItem('esthetic_cart', JSON.stringify(cart));
    updateCartCount();
    closeCheckout();

    setTimeout(() => {
        alert("Pedido enviado! Você foi redirecionado para o WhatsApp da loja.");
    }, 800);
}

// ================== MODAL DE DETALHES DO PRODUTO ==================
function showProductModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    currentProductId = productId;
    modalQuantity = 1;

    // Preencher imagem
    const img = document.getElementById('modal-product-image');
    img.src = product.image_url || 'https://picsum.photos/id/1018/600/600';
    img.alt = product.name;

    // Marca e Nome
    document.getElementById('modal-brand').textContent = (product.brand || 'Esthetic').toUpperCase();
    document.getElementById('modal-name').textContent = product.name;

    // Descrição
    const descEl = document.getElementById('modal-description');
    descEl.textContent = product.description || 'Produto premium para detalhamento automotivo de alta performance. Qualidade profissional para manter seu veículo impecável.';

    // Preço
    const hasDiscount = product.discount_price && product.discount_price < product.price;
    const finalPrice = hasDiscount ? product.discount_price : (product.price || 0);
    const priceContainer = document.getElementById('modal-price');

    if (product.price) {
        priceContainer.innerHTML = `
            <div class="flex items-end gap-x-3">
                <span class="text-[2.35rem] font-bold tracking-tighter">R$ ${finalPrice.toFixed(2).replace('.', ',')}</span>
                ${hasDiscount ? `
                    <span class="text-lg text-white/50 line-through mb-1">R$ ${product.price.toFixed(2).replace('.', ',')}</span>
                ` : ''}
            </div>
            ${hasDiscount ? `
                <div class="flex items-center gap-x-2 mt-1">
                    <span class="text-sm text-red-400 font-medium">Preço especial no Pix</span>
                </div>
            ` : ''}
        `;
    } else {
        priceContainer.innerHTML = `<div class="text-white/60 text-lg">Consulte o preço na loja</div>`;
    }

    // Badge de desconto
    const badge = document.getElementById('modal-discount-badge');
    if (hasDiscount) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }

    // Quantidade inicial
    document.getElementById('modal-quantity').textContent = modalQuantity;

    // Mostrar modal
    const modal = document.getElementById('product-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function changeModalQuantity(delta) {
    modalQuantity = Math.max(1, modalQuantity + delta);
    document.getElementById('modal-quantity').textContent = modalQuantity;
}

function addCurrentProductToCart() {
    if (!currentProductId) return;

    // Adiciona a quantidade selecionada no modal (sem evento de clique para evitar feedback do botão do card)
    addToCart(currentProductId, null, modalQuantity);

    closeProductModal();

    // Feedback amigável
    setTimeout(() => {
        const count = document.getElementById('cart-count');
        if (count) {
            count.style.transform = 'scale(1.3)';
            setTimeout(() => {
                if (count) count.style.transform = 'scale(1)';
            }, 180);
        }
    }, 300);
}

function closeProductModal() {
    const modal = document.getElementById('product-modal');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
}

// Init
function init() {
    initSupabase();
    updateCartCount();

    // Atualizar contador do carrinho ao voltar à página
    window.addEventListener('focus', updateCartCount);

    // Atalho de busca com /
    document.addEventListener('keydown', function (e) {
        if (e.key === '/' && document.activeElement.tagName === 'BODY') {
            e.preventDefault();
            document.getElementById('search-input').focus();
        }
    });

    console.log('%c[Esthetic Produtos] Página de produtos carregada', 'color:#555');
}

window.onload = init;