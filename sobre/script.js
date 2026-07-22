// Tailwind script
function initializeTailwind() {
    document.documentElement.style.setProperty('--accent-gold', '#ff6a00');
}

// Navbar scroll effect
function initNavbar() {
    const navbar = document.getElementById('navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('nav-scrolled', 'shadow-xl');
        } else {
            navbar.classList.remove('nav-scrolled', 'shadow-xl');
        }
    });

    // Mobile menu
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    mobileBtn.addEventListener('click', () => {
        if (mobileMenu.classList.contains('hidden')) {
            mobileMenu.classList.remove('hidden');
            mobileBtn.innerHTML = '<i class="fa-solid fa-times text-xl"></i>';
        } else {
            mobileMenu.classList.add('hidden');
            mobileBtn.innerHTML = '<i class="fa-solid fa-bars text-xl"></i>';
        }
    });

    // Close mobile menu on link click
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
            mobileBtn.innerHTML = '<i class="fa-solid fa-bars text-xl"></i>';
        });
    });
}

// Booking Modal
let bookingModal = null;

function showBookingModal() {
    bookingModal = document.getElementById('booking-modal');
    bookingModal.classList.remove('hidden');
    bookingModal.classList.add('flex');
}

function hideBookingModal() {
    if (bookingModal) {
        bookingModal.classList.remove('flex');
        bookingModal.classList.add('hidden');
    }
}

function submitBookingForm(e) {
    e.preventDefault();

    const form = e.target;

    // Get values using IDs
    const nome = document.getElementById('booking-nome').value.trim();
    const whatsappCliente = document.getElementById('booking-whatsapp').value.trim();
    const veiculo = document.getElementById('booking-veiculo').value.trim();
    const servico = document.getElementById('booking-servico').value;

    if (!nome || !whatsappCliente || !veiculo || !servico) {
        alert("Por favor, preencha todos os campos obrigatórios.");
        return;
    }

    // Create professional pre-filled message
    const mensagem = `Olá! Gostaria de agendar um serviço na *Esthetic Auto Detail*.

*Nome:* ${nome}
*Veículo:* ${veiculo}
*Serviço desejado:* ${servico}
*Meu WhatsApp:* ${whatsappCliente}

Aguardo seu contato para confirmar o horário. Obrigado!`;

    const mensagemEncoded = encodeURIComponent(mensagem);
    const whatsappURL = `https://wa.me/5581981749601?text=${mensagemEncoded}`;

    // Open WhatsApp in new tab
    window.open(whatsappURL, '_blank');

    // Close modal and reset form
    hideBookingModal();
    form.reset();

    // Show confirmation toast
    setTimeout(() => {
        showSuccessToast("Redirecionando para o WhatsApp da empresa com sua mensagem pronta!");
    }, 400);
}

// Contact form - redirects to WhatsApp with pre-filled message
function submitForm(e) {
    e.preventDefault();

    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;

    // Get form values
    const nome = document.getElementById('form-nome').value.trim();
    const whatsappCliente = document.getElementById('form-whatsapp').value.trim();
    const veiculo = document.getElementById('form-veiculo').value.trim();
    const servico = document.getElementById('form-servico').value;
    const mensagemAdicional = document.getElementById('form-mensagem').value.trim();

    if (!nome || !whatsappCliente) {
        alert("Por favor, preencha pelo menos Nome e WhatsApp.");
        return;
    }

    // Build professional message
    let mensagem = `Olá! Entrei em contato através do site da *Esthetic Auto Detail*.

*Nome:* ${nome}
*WhatsApp:* ${whatsappCliente}`;

    if (veiculo) mensagem += `\n*Veículo:* ${veiculo}`;
    if (servico) mensagem += `\n*Serviço de interesse:* ${servico}`;
    if (mensagemAdicional) mensagem += `\n\n*Observações:*\n${mensagemAdicional}`;

    mensagem += `\n\nAguardo seu retorno. Obrigado!`;

    const mensagemEncoded = encodeURIComponent(mensagem);
    const whatsappURL = `https://wa.me/5581981749601?text=${mensagemEncoded}`;

    // Show loading on button
    btn.innerHTML = `<span class="flex items-center justify-center gap-x-2"><i class="fa-solid fa-spinner fa-spin"></i> Abrindo WhatsApp...</span>`;
    btn.disabled = true;

    // Open WhatsApp after short delay (for UX)
    setTimeout(() => {
        window.open(whatsappURL, '_blank');

        // Reset form and button
        form.reset();
        btn.innerHTML = originalText;
        btn.disabled = false;

        // Success feedback
        showSuccessToast("Redirecionando para o WhatsApp da empresa com sua mensagem!");
    }, 650);
}

function showSuccessToast(message) {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-6 right-6 bg-[#0d0d0f] border border-[#ff6a00]/40 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-start gap-x-3 max-w-sm z-[200]`;
    toast.innerHTML = `
        <div class="mt-0.5"><i class="fa-solid fa-check-circle text-[#ff6a00] text-xl"></i></div>
        <div class="text-sm pr-2">${message}</div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'all 0.3s ease';
        toast.style.opacity = '0';
        setTimeout(() => toast.parentNode.removeChild(toast), 300);
    }, 4200);
}

// Gallery Image Modal
function showImageModal(element) {
    const modal = document.getElementById('image-modal');
    const img = document.getElementById('modal-image');
    const caption = document.getElementById('modal-caption');

    const originalImg = element.querySelector('img');
    img.src = originalImg.src;
    img.alt = originalImg.alt;

    const captionText = element.querySelector('.absolute') ?
        element.querySelector('.absolute').innerText.trim() :
        'Detalhamento Premium - Esthetic Auto Detail';

    caption.innerHTML = captionText;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function hideImageModal() {
    const modal = document.getElementById('image-modal');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
}

// Keyboard support
function initKeyboardSupport() {
    document.addEventListener('keydown', function (e) {
        if (e.key === "Escape") {
            const booking = document.getElementById('booking-modal');
            const image = document.getElementById('image-modal');

            if (!booking.classList.contains('hidden') && booking.classList.contains('flex')) {
                hideBookingModal();
            } else if (!image.classList.contains('hidden') && image.classList.contains('flex')) {
                hideImageModal();
            }
        }

        if (e.key === "/" && document.activeElement.tagName === "BODY") {
            e.preventDefault();
            document.getElementById('servicos').scrollIntoView({ behavior: 'smooth' });
        }
    });

    // Easter egg: press "e" for elegant mode (just for fun)
    let pressCount = 0;
    document.addEventListener('keypress', function (e) {
        if (e.key.toLowerCase() === 'e') {
            pressCount++;
            if (pressCount === 5) {
                document.documentElement.style.setProperty('--accent-gold', '#d4af37');
                pressCount = 0;
                setTimeout(() => {
                    document.documentElement.style.setProperty('--accent-gold', '#ff6a00');
                }, 2200);
            }
        }
    });
}

// Comparador Antes e Depois interativo - VERSÃO CORRIGIDA E MELHORADA
function initComparisonSlider() {
    const container = document.getElementById('comparison-container');
    const afterImage = document.getElementById('after-image');
    const handle = document.getElementById('slider-handle');

    if (!container || !afterImage || !handle) return;

    let isDragging = false;

    function updateSlider(clientX) {
        const rect = container.getBoundingClientRect();
        let percent = ((clientX - rect.left) / rect.width) * 100;

        // Limitar entre 5% e 95% para não sumir completamente as imagens
        percent = Math.max(5, Math.min(95, percent));

        // Atualizar clip-path da imagem depois (mostra da esquerda até 'percent')
        afterImage.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;

        // Mover a alça (linha divisória + círculo)
        handle.style.left = `${percent}%`;
    }

    // Iniciar arrasto no handle (mouse)
    handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        e.preventDefault(); // evita comportamentos indesejados
        // Atualiza imediatamente para a posição do clique no handle (opcional, mas bom)
        updateSlider(e.clientX);
    });

    // Iniciar arrasto no handle (touch) - CORRIGIDO para mobile
    handle.addEventListener('touchstart', (e) => {
        isDragging = true;
        e.preventDefault();
        if (e.touches.length > 0) {
            updateSlider(e.touches[0].clientX);
        }
    }, { passive: false });

    // Mouse events globais
    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            updateSlider(e.clientX);
        }
    });

    // Touch events globais - CORRIGIDO com preventDefault para não rolar a página
    window.addEventListener('touchend', () => {
        isDragging = false;
    });

    window.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length > 0) {
            e.preventDefault(); // Impede o scroll da página enquanto arrasta a barra
            updateSlider(e.touches[0].clientX);
        }
    }, { passive: false });

    // Clique direto na área da imagem também move a barra instantaneamente (bom para desktop e mobile)
    container.addEventListener('click', (e) => {
        // Só move se não estiver no meio de um arrasto
        if (!isDragging) {
            updateSlider(e.clientX);
        }
    });

    // Posição inicial (50%)
    afterImage.style.clipPath = 'inset(0 50% 0 0)';
    handle.style.left = '50%';

    // Dica: agora o arrasto funciona de forma suave no desktop e mobile sem travar ou rolar a página
}

// Smooth scroll animations using Intersection Observer
function initScrollAnimations() {
    const animatedElements = document.querySelectorAll('.animate-fade-in-up, section > div');

    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
    });

    // Apply animation to key sections
    document.querySelectorAll('#sobre, #servicos, #produtos, #avaliacoes, #galeria, #contato').forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        section.style.transition = 'opacity 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
        observer.observe(section);
    });
}

// Initialize everything
function init() {
    initializeTailwind();
    initNavbar();
    initKeyboardSupport();
    initComparisonSlider();   // Comparador antes/depois corrigido
    initScrollAnimations();   // Animações suaves ao rolar

    // Preload images (optional)
    console.log('%c[Esthetic Auto Detail] Site estático profissional carregado com sucesso.', 'color:#555');

    // Bonus: subtle animation on service cards when they enter viewport
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.service-card').forEach(card => {
        card.style.opacity = '0.95';
        card.style.transition = 'opacity 0.6s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
        observer.observe(card);
    });
}

window.onload = init;