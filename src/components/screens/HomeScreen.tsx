import { useNavigate } from 'react-router-dom';

export function HomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
         style={{ background: 'radial-gradient(ellipse at center, #1A1A1A 0%, #0A0A0A 70%)' }}>
      {/* Title */}
      <div className="text-center mb-16">
        <h1 className="font-[Cinzel] text-5xl md:text-7xl font-bold text-gold-gradient mb-4">
          POKER AI
        </h1>
        <p className="font-[DM_Mono] text-text-secondary text-sm md:text-base tracking-wider">
          NEUROSYMBOLIC POKER ASSISTANT
        </p>
        <div className="w-20 h-0.5 bg-gradient-to-r from-transparent via-gold-primary to-transparent mx-auto mt-6" />
      </div>

      {/* Game Mode Cards */}
      <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl">
        {/* VS Bots Mode */}
        <button
          onClick={() => navigate('/setup?mode=VS_BOTS')}
          className="group flex-1 bg-noir-card border border-noir-border rounded-lg p-8 text-left
                     hover:border-gold-primary/50 hover:shadow-[0_0_20px_rgba(201,168,76,0.15)]
                     transition-all duration-300 btn-press cursor-pointer"
        >
          <div className="text-3xl mb-4">🤖</div>
          <h2 className="font-[Cinzel] text-xl text-text-primary mb-2 group-hover:text-gold-light transition-colors">
            VS AI Bots
          </h2>
          <p className="text-text-muted text-sm leading-relaxed">
            Play against 2-3 AI opponents with unique personalities.
            Your AI advisor helps you read the table.
          </p>
          <div className="mt-4 font-[DM_Mono] text-xs text-gold-muted">
            1 PLAYER + AI ADVISOR
          </div>
        </button>

        {/* Local 2-Player Mode */}
        <button
          onClick={() => navigate('/setup?mode=LOCAL_2P')}
          className="group flex-1 bg-noir-card border border-noir-border rounded-lg p-8 text-left
                     hover:border-gold-primary/50 hover:shadow-[0_0_20px_rgba(201,168,76,0.15)]
                     transition-all duration-300 btn-press cursor-pointer"
        >
          <div className="text-3xl mb-4">👥</div>
          <h2 className="font-[Cinzel] text-xl text-text-primary mb-2 group-hover:text-gold-light transition-colors">
            Local 2-Player
          </h2>
          <p className="text-text-muted text-sm leading-relaxed">
            Two players on one device. Only one gets AI help — see how much it matters.
          </p>
          <div className="mt-4 font-[DM_Mono] text-xs text-gold-muted">
            2 PLAYERS &middot; 1 AI ADVISOR
          </div>
        </button>
      </div>

      {/* How to Play */}
      <div className="mt-10">
        <button
          onClick={() => navigate('/instructions')}
          className="group bg-noir-card border border-noir-border rounded-lg px-8 py-4 text-center
                     hover:border-gold-primary/50 hover:shadow-[0_0_20px_rgba(201,168,76,0.1)]
                     transition-all duration-300 btn-press cursor-pointer"
        >
          <h2 className="font-[Cinzel] text-base text-text-secondary group-hover:text-gold-light transition-colors">
            How to Play
          </h2>
          <p className="text-text-muted text-xs mt-1">
            Learn poker rules, hand rankings &amp; how the AI works
          </p>
        </button>
      </div>

      {/* Footer */}
      <div className="mt-10 text-text-muted text-xs font-[DM_Mono] tracking-widest">
        HAND STRENGTH &middot; CONFIDENCE SCORE &middot; OPPONENT PROFILING
      </div>
    </div>
  );
}
