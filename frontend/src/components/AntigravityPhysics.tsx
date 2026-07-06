import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

type AntigravityPhysicsProps = {
  isActive: boolean;
  onClose: () => void;
};

type CloneItem = {
  id: string;
  className: string;
  innerHTML: string;
  rect: DOMRect;
};

export default function AntigravityPhysics({ isActive, onClose }: AntigravityPhysicsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [clones, setClones] = useState<CloneItem[]>([]);

  // Capture original layout elements and hide them
  useEffect(() => {
    if (!isActive) return;

    // Temporarily pause body scrolling to contain simulation
    document.body.style.overflow = 'hidden';

    const items = document.querySelectorAll('.antigravity-item');
    const newClones: CloneItem[] = [];

    items.forEach((item, index) => {
      const htmlItem = item as HTMLElement;
      const rect = htmlItem.getBoundingClientRect();

      // Don't clone empty or hidden elements
      if (rect.width === 0 || rect.height === 0) return;

      // Extract all user classes, ignoring layout flex/grid offsets if needed
      // but keeping basic shapes, backgrounds, borders, colors, and paddings.
      newClones.push({
        id: `antigravity-clone-${index}`,
        className: htmlItem.className,
        innerHTML: htmlItem.innerHTML,
        rect,
      });

      // Hide original
      htmlItem.style.visibility = 'hidden';
      htmlItem.style.pointerEvents = 'none';
    });

    setClones(newClones);

    return () => {
      document.body.style.overflow = '';
      items.forEach((item) => {
        const htmlItem = item as HTMLElement;
        htmlItem.style.visibility = '';
        htmlItem.style.pointerEvents = '';
      });
    };
  }, [isActive]);

  // Matter.js Physics loop
  useEffect(() => {
    if (!isActive || clones.length === 0 || !containerRef.current) return;

    const { Engine, World, Bodies, Mouse, MouseConstraint, Runner, Body } = Matter;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Create engine with a slight upward gravity drift (antigravity!)
    const engine = Engine.create();
    engine.gravity.x = 0;
    engine.gravity.y = -0.05; // Gentle float upwards

    const world = engine.world;

    // Viewport border boundaries (thick walls so blocks don't pop out)
    const thickness = 200;
    const boundaries = [
      // Floor
      Bodies.rectangle(width / 2, height + thickness / 2, width * 3, thickness, { isStatic: true }),
      // Ceiling
      Bodies.rectangle(width / 2, -thickness / 2, width * 3, thickness, { isStatic: true }),
      // Left Wall
      Bodies.rectangle(-thickness / 2, height / 2, thickness, height * 3, { isStatic: true }),
      // Right Wall
      Bodies.rectangle(width + thickness / 2, height / 2, thickness, height * 3, { isStatic: true }),
    ];

    World.add(world, boundaries);

    // Create a physics body for each cloned element
    const bodyItems = clones.map((clone) => {
      // Calculate center coordinates of the card
      const x = clone.rect.left + clone.rect.width / 2;
      const y = clone.rect.top + clone.rect.height / 2;

      const body = Bodies.rectangle(x, y, clone.rect.width, clone.rect.height, {
        restitution: 0.75, // Bouncy collisions
        friction: 0.1,
        frictionAir: 0.015, // Air resistance
      });

      // Inject small random initial impulse for floating variety
      Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 1.5,
        y: -Math.random() * 2 - 0.5,
      });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.03);

      return {
        id: clone.id,
        body,
        width: clone.rect.width,
        height: clone.rect.height,
      };
    });

    World.add(world, bodyItems.map((item) => item.body));

    // Mouse control logic to allow dragging and tossing
    const mouse = Mouse.create(containerRef.current);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.15,
        render: { visible: false },
      },
    });

    World.add(world, mouseConstraint);

    // Run the engine
    const runner = Runner.create();
    Runner.run(runner, engine);

    // Synchronize DOM positions with Matter.js simulated coordinates
    let animationFrameId: number;
    const syncDOM = () => {
      bodyItems.forEach((item) => {
        const domElement = document.getElementById(item.id);
        if (domElement) {
          const { x, y } = item.body.position;
          const angle = item.body.angle;

          // Position using translate3d & rotate to maintain high FPS and layout crispness
          domElement.style.transform = `translate3d(${x - item.width / 2}px, ${y - item.height / 2}px, 0px) rotate(${angle}rad)`;
        }
      });

      animationFrameId = requestAnimationFrame(syncDOM);
    };

    syncDOM();

    return () => {
      cancelAnimationFrame(animationFrameId);
      Runner.stop(runner);
      World.clear(world, false);
      Engine.clear(engine);
    };
  }, [isActive, clones]);

  if (!isActive) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-md select-none touch-none"
    >
      {/* Top Banner Control HUD */}
      <div className="absolute inset-x-0 top-6 z-50 flex flex-col items-center justify-between gap-4 px-6 sm:flex-row lg:px-10 pointer-events-none">
        <div className="rounded-2xl border border-white/10 bg-black/60 px-5 py-3 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500"></span>
            </span>
            <div>
              <h2 className="text-sm font-bold tracking-wider text-text uppercase">Antigravity Simulation Active</h2>
              <p className="text-xs text-muted">Click and throw the cards! They drift upwards in zero gravity.</p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="pointer-events-auto rounded-full bg-white px-6 py-3 text-sm font-bold text-background shadow-2xl transition hover:scale-[1.05] active:scale-[0.98]"
        >
          Restore Gravity
        </button>
      </div>

      {/* Surface showing the floating duplicates */}
      <div className="relative w-full h-full pointer-events-none">
        {clones.map((clone) => (
          <div
            key={clone.id}
            id={clone.id}
            className={`${clone.className} absolute left-0 top-0 m-0 origin-center pointer-events-auto shadow-2xl transition-shadow duration-300 hover:shadow-primary/20`}
            style={{
              width: clone.rect.width,
              height: clone.rect.height,
              transform: `translate3d(${clone.rect.left}px, ${clone.rect.top}px, 0px)`,
              willChange: 'transform',
            }}
            dangerouslySetInnerHTML={{ __html: clone.innerHTML }}
          />
        ))}
      </div>
    </div>
  );
}
