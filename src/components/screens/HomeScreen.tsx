import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function HomeScreen() {
  const navigate = useNavigate();

  return (
    <div
      className="relative min-h-screen px-4 py-6 md:px-8"
      style={{ background: 'radial-gradient(ellipse at center, #1A1A1A 0%, #0A0A0A 70%)' }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
           style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '3px 3px' }} />
      <div className="pointer-events-none absolute top-8 left-8 text-[80px] text-gold-primary/10">♠</div>
      <div className="pointer-events-none absolute top-24 right-10 text-[70px] text-gold-primary/10">♦</div>
      <div className="pointer-events-none absolute bottom-24 left-12 text-[72px] text-gold-primary/10">♣</div>
      <div className="pointer-events-none absolute bottom-10 right-14 text-[84px] text-gold-primary/10">♥</div>

      <div className="pointer-events-none mx-auto mb-4 h-px w-full max-w-6xl bg-gradient-to-r from-transparent via-gold-primary/60 to-transparent" />

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-5">
        <RevealSection className="pt-2 text-center">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-75"
               style={{ background: 'radial-gradient(ellipse at center, rgba(201,168,76,.17) 0%, transparent 72%)' }} />
          <div className="mb-3 flex items-center justify-center gap-3">
            <div className="relative inline-block">
              <h1 className="font-[Cinzel] text-5xl font-bold text-gold-gradient md:text-7xl">
                POKER AI
              </h1>
              <span
                className="pointer-events-none absolute inset-y-0 left-[-20%] w-[28%]"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.38), transparent)',
                  transform: 'skewX(-18deg)',
                  animation: 'homeSheen 2.8s ease-out .25s 1 both',
                }}
              />
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-gold-border/45 bg-noir-bg/40 px-3 py-1 font-[DM_Mono] text-[10px] uppercase tracking-[0.18em] text-text-secondary">
              <span className="h-2 w-2 rounded-full bg-gold-primary animate-pulse shadow-[0_0_12px_rgba(201,168,76,0.65)]" />
              High Roller Arena
            </div>
          </div>
          <div className="mx-auto mt-3 h-px w-44 bg-gradient-to-r from-transparent via-gold-primary/80 to-transparent" />
          <p className="mt-2 font-[DM_Mono] text-xs tracking-[0.2em] text-text-secondary md:text-sm">
            NEUROSYMBOLIC POKER ASSISTANT
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Play sharp hands, read live confidence signals, and train against adaptive opponents.
          </p>
        </RevealSection>

        <RevealSection className="grid gap-4 md:grid-cols-2">
          <ModeCard
            title="VS AI Bots"
            description="Play against 2-3 AI opponents with distinct personalities while your advisor tracks exploitable betting patterns."
            icon="🤖"
            ribbon="Recommended"
            illustration="🂡 🂮 🂭"
            chips={['◉ 1 Human', '◎ 2-3 Bots', '✦ Live Confidence', '◇ Post-Round Audit']}
            onClick={() => navigate('/setup?mode=VS_BOTS')}
          />
          <ModeCard
            title="Local 2-Player"
            description="Battle on one device with handover flow and selective AI assistance to test decision quality under pressure."
            icon="👥"
            illustration="◖  ◗"
            chips={['◎ 2 Humans', '✦ 1 Advisor', '◇ Handover Safe', '◌ Reveal Analysis']}
            onClick={() => navigate('/setup?mode=LOCAL_2P')}
          />
        </RevealSection>

        <RevealSection className="grid gap-4 md:grid-cols-2">
          <BottomCard
            title="How to Play"
            body="Rules, hand rankings, table flow, and AI guidance system."
            onClick={() => navigate('/instructions')}
          />
          <BottomCard
            title="Game Stats"
            body="Pot trends, profile reads, confidence signals, and training metrics."
            onClick={() => navigate('/stats')}
          />
        </RevealSection>

        <RevealSection className="mt-1 pb-2">
          <div className="text-center font-[DM_Mono] text-xs tracking-widest text-text-muted">
            HAND STRENGTH &middot; CONFIDENCE SCORE &middot; OPPONENT PROFILING
          </div>
        </RevealSection>
      </main>
    </div>
  );
}

function RevealSection({ className, children }: { className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(14px)',
        transition: 'opacity 300ms ease-out, transform 300ms ease-out',
      }}
    >
      {children}
    </section>
  );
}

function ModeCard({
  title,
  description,
  icon,
  illustration,
  chips,
  onClick,
  ribbon,
}: {
  title: string;
  description: string;
  icon: string;
  illustration: string;
  chips: string[];
  onClick: () => void;
  ribbon?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative h-full overflow-hidden rounded-2xl p-[1px] text-left transition-all duration-300 ease-out hover:-translate-y-1 hover:[transform:perspective(900px)_rotateX(3deg)] focus:outline-none focus:ring-1 focus:ring-gold-primary/55 cursor-pointer"
      style={{ background: 'linear-gradient(140deg, rgba(201,168,76,.35), rgba(255,255,255,.05), rgba(201,168,76,.45))' }}
    >
      <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: 'conic-gradient(from 140deg, transparent, rgba(201,168,76,.32), transparent)' }} />
      <div className="relative h-full rounded-2xl border border-noir-border/80 bg-noir-card/92 p-6 transition-all duration-300 group-hover:border-gold-border/45 group-hover:shadow-[inset_0_0_0_1px_rgba(201,168,76,.22),0_16px_36px_rgba(0,0,0,.38)]">
        {ribbon && (
          <div className="absolute -right-10 top-5 rotate-45 bg-gold-primary/18 px-10 py-1 font-[DM_Mono] text-[9px] uppercase tracking-[0.18em] text-gold-light">
            {ribbon}
          </div>
        )}
        <div className="pointer-events-none absolute right-4 top-6 text-4xl text-gold-primary/10">{illustration}</div>

        <div className="mb-4 flex items-center gap-2">
          <span className="text-3xl">{icon}</span>
          <h2 className="font-[Cinzel] text-2xl text-text-primary transition-colors duration-300 group-hover:text-gold-light">{title}</h2>
        </div>

        <p className="min-h-[66px] text-sm leading-relaxed text-text-muted">{description}</p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {chips.map(chip => (
            <span key={chip} className="rounded-full border border-gold-border/28 px-2 py-1 text-center font-[DM_Mono] text-[10px] uppercase tracking-[0.1em] text-text-secondary">
              {chip}
            </span>
          ))}
        </div>

        <div className="mt-6">
          <div className="flex w-full items-center justify-center rounded-lg bg-gold-primary px-4 py-2.5 font-[DM_Mono] text-[11px] uppercase tracking-[0.14em] text-noir-bg transition-all duration-300 ease-out group-hover:bg-gold-light">
            Enter Table
            <span className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function BottomCard({ title, body, onClick }: { title: string; body: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-full rounded-xl border border-noir-border bg-noir-card/80 px-5 py-5 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-gold-primary/45 hover:shadow-[0_0_20px_rgba(201,168,76,0.1)] focus:outline-none focus:ring-1 focus:ring-gold-primary/55 cursor-pointer"
    >
      <h2 className="font-[Cinzel] text-lg text-text-secondary transition-colors duration-300 hover:text-gold-light">
        {title}
      </h2>
      <p className="mt-1 text-xs text-text-muted">{body}</p>
      <div className="mt-4 inline-flex items-center gap-2 font-[DM_Mono] text-[10px] uppercase tracking-[0.12em] text-gold-muted">
        View
        <span>&rsaquo;</span>
      </div>
    </button>
  );
}

