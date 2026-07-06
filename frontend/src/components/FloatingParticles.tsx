import { useEffect, useRef } from 'react';

function FloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const particles: Particle[] = [];
    const particleCount = 65; // Slightly denser for better visibility
    const connectionDistance = 90;
    const mouse = { x: -1000, y: -1000, radius: 150 };

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      baseAlpha: number;
      twinkleSpeed: number;
      phase: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        // Float upwards gently
        this.vx = (Math.random() - 0.5) * 0.15;
        this.vy = -Math.random() * 0.35 - 0.1;
        // Varying star sizes
        this.radius = Math.random() * 2 + 1;
        // Brighter base opacity for better visibility
        this.baseAlpha = Math.random() * 0.55 + 0.35;
        this.twinkleSpeed = Math.random() * 0.03 + 0.01;
        this.phase = Math.random() * Math.PI * 2;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.phase += this.twinkleSpeed;

        // Wrap around bottom
        if (this.y < 0) {
          this.y = height;
          this.x = Math.random() * width;
        }
        if (this.x < 0 || this.x > width) {
          this.vx = -this.vx;
        }

        // Mouse repelling (gently nudges stars away)
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          const angle = Math.atan2(dy, dx);
          this.x += Math.cos(angle) * force * 1.8;
          this.y += Math.sin(angle) * force * 1.8;
        }
      }

      draw(context: CanvasRenderingContext2D) {
        // Twinkling effect
        const alpha = this.baseAlpha + Math.sin(this.phase) * 0.25;
        const clampedAlpha = Math.max(0.15, Math.min(1.0, alpha));

        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        
        // Pure glowing white stars
        context.fillStyle = `rgba(255, 255, 255, ${clampedAlpha})`;
        context.shadowColor = 'rgba(255, 255, 255, 0.9)';
        context.shadowBlur = this.radius * 3.5;
        context.fill();
        context.shadowBlur = 0; // reset
      }
    }

    // Initialize
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    const drawConnections = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

          if (dist < connectionDistance) {
            // Very faint white constellation lines
            const alpha = ((connectionDistance - dist) / connectionDistance) * 0.05;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.update();
        p.draw(ctx);
      });

      drawConnections();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    const handleResize = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    window.addEventListener('resize', handleResize);
    canvas.parentElement?.addEventListener('mousemove', handleMouseMove);
    canvas.parentElement?.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.parentElement?.removeEventListener('mousemove', handleMouseMove);
      canvas.parentElement?.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full pointer-events-none opacity-90"
    />
  );
}

export default FloatingParticles;
