(() => {
  const header = document.querySelector('.site-header');
  const onScrollHeader = () => header.classList.toggle('is-solid', window.scrollY > 12);
  onScrollHeader();
  window.addEventListener('scroll', onScrollHeader, { passive: true });

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !window.gsap || !window.ScrollTrigger) return; // conteúdo já é visível sem movimento

  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add('motion');

  // Scroll suave sincronizado com o ScrollTrigger
  if (window.Lenis) {
    const lenis = new Lenis({ lerp: 0.11, anchors: { offset: -76 } });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const ease = 'expo.out';
  const intro = document.querySelector('.intro');
  const aperture = document.querySelector('.aperture');
  const eyeSvg = document.querySelector('.eye');

  // Olho 3D (assets/eye3d.js). Sem WebGL, o logo em SVG continua no lugar.
  let eye3d = null;
  const host3d = document.querySelector('.hero-3d');
  if (window.Eye3D && host3d && Eye3D.supported()) {
    try {
      eye3d = Eye3D.create(host3d, { anchor: document.querySelector('.hero-eye') });
      document.documentElement.classList.add('has-3d');
    } catch (err) { eye3d = null; }
  }
  const s3d = { intro: 0, focus: 0, explode: 0, labels: 0, rot: 0, dolly: 0 };
  const push3d = () => eye3d && eye3d.update(s3d);

  // 1. Entrada: o olho aparece (3D) ou pisca uma vez (SVG) e o texto sobe
  const entry = gsap.timeline({ defaults: { ease } });
  if (eye3d) {
    push3d();
    entry.to(s3d, { intro: 1, duration: 1.6, onUpdate: push3d }, 0.1);
  } else {
    entry
      // y em unidades do viewBox (240x120); yPercent em SVG <use> mede o símbolo inteiro e trava
      .fromTo('.lid-up', { y: 24, rotate: 3 }, { y: 0, rotate: 0, duration: 1.1 }, 0.15)
      .fromTo('.lid-down', { y: -18, rotate: -2 }, { y: 0, rotate: 0, duration: 1.1 }, 0.15)
      .from('.iris', { scale: 0.4, opacity: 0, duration: 1.2 }, 0.35);
  }
  entry.from('.hero-copy > *', { y: 28, opacity: 0, duration: 1, stagger: 0.08 }, 0.1);

  // 2. Scroll: SVG = pálpebras abrem; 3D = volta de 360° com as peças separadas e mergulho na pupila.
  // Nos dois casos um círculo cresce a partir da íris e revela a seção das médicas.
  // Mede pelo SVG (sem transform), não pela íris, que pode estar no meio da animação de entrada
  const geom = () => {
    const a = intro.getBoundingClientRect();
    let cx = a.width / 2, cy = Math.min(a.height, window.innerHeight) / 2; // 3D: a pupila termina no centro da tela
    if (!eye3d) {
      const s = eyeSvg.getBoundingClientRect();
      const k = s.width / 240; // viewBox 240x120; íris elíptica em (128, 62), rx 23,75 ry 19,25
      cx = s.left + 128 * k - a.left;
      cy = s.top + 62 * k - a.top;
    }
    const far = Math.hypot(Math.max(cx, a.width - cx), Math.max(cy, a.height - cy));
    return { cx, cy, r1: far + 40 };
  };
  let g = geom();
  const place = () => {
    g = geom();
    aperture.style.setProperty('--cx', g.cx + 'px');
    aperture.style.setProperty('--cy', g.cy + 'px');
  };
  place();
  aperture.style.setProperty('--r', '0px');

  const open = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: intro,
      start: 'top top',
      end: eye3d ? '+=480%' : '+=170%',
      pin: true,
      scrub: 0.6,
      invalidateOnRefresh: true,
      onRefreshInit: () => { gsap.set(aperture, { '--r': '0px' }); },
      onRefresh: () => { place(); if (eye3d) eye3d.resize(); },
    },
  });

  if (eye3d) {
    const t = (vars, at) => open.to(s3d, { ...vars, onUpdate: push3d }, at);
    t({ focus: 1, duration: 0.12, ease: 'power2.inOut' }, 0);
    open.to('.hero-copy', { opacity: 0, y: -40, filter: 'blur(6px)', duration: 0.1 }, 0.02);
    t({ rot: Math.PI * 2, duration: 0.54, ease: 'power1.inOut' }, 0.08);
    t({ explode: 1, duration: 0.2, ease: 'power2.inOut' }, 0.1);
    t({ labels: 1, duration: 0.08 }, 0.24);
    t({ labels: 0, duration: 0.06 }, 0.52);
    t({ explode: 0, duration: 0.12, ease: 'power2.inOut' }, 0.56);
    t({ dolly: 1, duration: 0.2, ease: 'power1.in' }, 0.68);
    open
      .fromTo(aperture, { '--r': '0px' }, { '--r': () => g.r1 + 'px', duration: 0.12, ease: 'power2.in' }, 0.84)
      .to('.aperture-tint', { opacity: 0, duration: 0.1 }, 0.96)
      .from('.portrait img', { scale: 1.2, duration: 0.14 }, 0.9)
      .from('.portrait-lid-up', { y: 40, opacity: 0, duration: 0.08, ease: 'power2.out' }, 1.0)
      .from('.portrait-lid-down', { y: -40, opacity: 0, duration: 0.08, ease: 'power2.out' }, 1.0)
      .from('.aperture-copy > *', { y: 30, opacity: 0, stagger: 0.015, duration: 0.07, ease: 'power2.out' }, 1.0)
      .to({}, { duration: 0.1 }); // pausa com a seção inteira na tela antes de soltar
  } else open
    // fromTo explícito: o .to capturaria o estado meio-fechado da animação de entrada
    .fromTo('.lid-up', { y: 0, rotate: 0 }, { y: -70, rotate: -4, opacity: 0, duration: 0.45, ease: 'power2.in', immediateRender: false }, 0)
    .fromTo('.lid-down', { y: 0, rotate: 0 }, { y: 60, rotate: 3, opacity: 0, duration: 0.45, ease: 'power2.in', immediateRender: false }, 0)
    .to('.hero-copy', { opacity: 0, y: -40, filter: 'blur(6px)', duration: 0.35 }, 0.05)
    // começa em 0: parada no topo, a borda do recorte desenharia um anel fino sobre a íris
    .fromTo(aperture, { '--r': '0px' }, { '--r': () => g.r1 + 'px', duration: 0.6, ease: 'power2.in' }, 0.12)
    .to('.aperture-tint', { opacity: 0, duration: 0.25 }, 0.5)
    .from('.portrait img', { scale: 1.25, duration: 0.5 }, 0.3)
    .from('.portrait-lid-up', { y: 40, opacity: 0, duration: 0.25, ease: 'power2.out' }, 0.62)
    .from('.portrait-lid-down', { y: -40, opacity: 0, duration: 0.25, ease: 'power2.out' }, 0.62)
    .from('.aperture-copy > *', { y: 30, opacity: 0, stagger: 0.04, duration: 0.2, ease: 'power2.out' }, 0.62)
    .to({}, { duration: 0.18 }); // pausa com a seção inteira na tela antes de soltar

  // 3. Exames: a tabela entra em foco e a lente vai de −2,50 a 0,00
  const dioptre = document.querySelector('.dioptre-value');
  const rows = [...document.querySelectorAll('.chart .row')];
  const exams = [...document.querySelectorAll('.exam')];
  const fmt = (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2).replace('.', ',');
  dioptre.textContent = fmt(-2.5);

  const setDioptre = (p) => { dioptre.textContent = fmt(Math.min(0, -2.5 + Math.round(p * 10) * 0.25)); };
  const clamp01 = gsap.utils.clamp(0, 1);

  const mm = gsap.matchMedia();
  // Desktop: título, tabela e lente ficam parados; só a lista de exames sobe dentro da janela
  mm.add('(min-width: 861px)', () => {
    const section = document.querySelector('.exams');
    const win = document.querySelector('.exam-window');
    const list = document.querySelector('.exam-list');
    const setY = gsap.quickSetter(list, 'y', 'px');
    let winH = 0, focusOff = 0, tops = [], travel = 1, total = 1;

    const measure = () => {
      winH = win.clientHeight;
      focusOff = winH * 0.1; // ponto de foco: logo abaixo da borda de cima da janela
      tops = exams.map((el) => el.offsetTop);
      travel = Math.max(1, tops[tops.length - 1] - focusOff); // último exame para no ponto de foco
      total = travel + winH * 0.3; // scroll extra com o último exame parado antes de soltar a seção
    };

    const render = (p) => {
      const t = Math.min(p * total, travel);
      setY(-t);
      let current = 0;
      exams.forEach((el, i) => {
        const focus = tops[i] - focusOff;
        const start = focus - winH * 0.55;
        const k = i === 0 ? 1 : clamp01((t - start) / (focus - start));
        rows[i].style.filter = `blur(${(9 * (1 - k)).toFixed(2)}px)`;
        rows[i].style.opacity = (0.35 + 0.65 * k).toFixed(3);
        el.style.opacity = (0.25 + 0.75 * k).toFixed(3);
        if (t >= focus - winH * 0.25) current = i;
      });
      rows.forEach((r, i) => r.classList.toggle('is-current', i === current));
      setDioptre(t / travel);
    };

    measure();
    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: () => '+=' + total,
      pin: true,
      onRefreshInit: measure,
      onRefresh: (st) => render(st.progress),
      onUpdate: (st) => render(st.progress),
    });
    render(0);

    return () => {
      gsap.set(list, { clearProps: 'transform' });
      [...rows, ...exams].forEach((el) => { el.style.filter = ''; el.style.opacity = ''; el.classList.remove('is-current'); });
    };
  });
  mm.add('(max-width: 860px)', () => {
    ScrollTrigger.create({
      trigger: '.exam-list', start: 'top 75%', end: 'bottom 60%',
      onUpdate: (st) => setDioptre(st.progress),
    });
    exams.forEach((el) => {
      gsap.fromTo(el.querySelector('.exam-word'), { filter: 'blur(8px)', opacity: 0.35 }, {
        filter: 'blur(0px)', opacity: 1, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 90%', end: 'top 55%', scrub: true },
      });
    });
  });

  // 4. Consulta: a foto do refrator se revela de baixo para cima
  gsap.fromTo('.visit-photo', { clipPath: 'inset(18% 8% 18% 8% round 14px)' }, {
    clipPath: 'inset(0% 0% 0% 0% round 14px)', ease: 'none',
    scrollTrigger: { trigger: '.visit', start: 'top 85%', end: 'top 25%', scrub: true },
  });
  gsap.fromTo('.visit-photo img', { scale: 1.18 }, {
    scale: 1, ease: 'none',
    scrollTrigger: { trigger: '.visit', start: 'top 85%', end: 'top 25%', scrub: true },
  });
  gsap.utils.toArray('.steps li').forEach((li) => {
    gsap.from(li, {
      opacity: 0, y: 32, duration: 0.9, ease,
      scrollTrigger: { trigger: li, start: 'top 88%', once: true },
    });
  });

  // Instagram: a foto real se abre de dentro para fora
  gsap.fromTo('.insta-photo', { clipPath: 'inset(12% 12% 12% 12% round 14px)' }, {
    clipPath: 'inset(0% 0% 0% 0% round 14px)', ease: 'none',
    scrollTrigger: { trigger: '.insta', start: 'top 85%', end: 'top 35%', scrub: true },
  });

  // 5. Contato: os dígitos do telefone sobem um a um com o scroll
  const phone = document.querySelector('.phone');
  phone.innerHTML = [...phone.textContent].map((c) => `<span class="ch" aria-hidden="true">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  gsap.from(phone.querySelectorAll('.ch'), {
    yPercent: 70, opacity: 0, rotate: 6, ease: 'none', stagger: 0.06,
    scrollTrigger: { trigger: '.contact', start: 'top 80%', end: 'top 30%', scrub: true },
  });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
