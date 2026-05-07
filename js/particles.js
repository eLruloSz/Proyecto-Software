/* ========================================
       PARTÍCULAS EN CANVAS
    ======================================== */
    const canvas = document.getElementById('particleCanvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    let mouseX = -1000, mouseY = -1000;

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Rastrear posición del mouse para interacción con partículas
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    class Particle {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.speedY = (Math.random() - 0.5) * 0.4;
        this.opacity = Math.random() * 0.5 + 0.1;
        this.baseOpacity = this.opacity;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Interacción con mouse: las partículas se alejan suavemente
        const dx = this.x - mouseX;
        const dy = this.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          const force = (150 - dist) / 150;
          this.x += (dx / dist) * force * 0.8;
          this.y += (dy / dist) * force * 0.8;
          this.opacity = Math.min(1, this.baseOpacity + force * 0.5);
        } else {
          this.opacity += (this.baseOpacity - this.opacity) * 0.05;
        }

        // Wrap around
        if (this.x < -10) this.x = canvas.width + 10;
        if (this.x > canvas.width + 10) this.x = -10;
        if (this.y < -10) this.y = canvas.height + 10;
        if (this.y > canvas.height + 10) this.y = -10;
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0.1, this.size), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 180, 216, ${this.opacity})`;
        ctx.fill();
      }
    }

    // Crear partículas (cantidad según tamaño de pantalla)
    function initParticles() {
      const count = Math.min(80, Math.floor((canvas.width * canvas.height) / 15000));
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push(new Particle());
      }
    }
    initParticles();

    function drawConnections() {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const opacity = (1 - dist / 120) * 0.15;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0, 180, 216, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    function animateParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      drawConnections();
      requestAnimationFrame(animateParticles);
    }

    // Respetar preferencia de movimiento reducido
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReduced) {
      animateParticles();
    }