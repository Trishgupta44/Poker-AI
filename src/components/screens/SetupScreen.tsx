import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGameStore } from '../../store/game-store';
import type { GameMode, GameConfig } from '../../types/game';

export function SetupScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('mode') ?? 'VS_BOTS') as GameMode;
  const initGame = useGameStore(s => s.initGame);

  const [smallBlind, setSmallBlind] = useState(10);
  const [bigBlind, setBigBlind] = useState(20);
  const [startingChips, setStartingChips] = useState(1000);
  const [botCount, setBotCount] = useState(3);

  const handleStart = () => {
    const config: GameConfig = {
      mode,
      smallBlind,
      bigBlind,
      startingChips,
      botCount: mode === 'VS_BOTS' ? botCount : 0,
      aiAssistedPlayerIds: [], // Set in game-controller
      actionTimerSeconds: 0,
    };

    initGame(config);
    navigate('/game');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
         style={{ background: 'radial-gradient(ellipse at center, #1A1A1A 0%, #0A0A0A 70%)' }}>

      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 text-text-muted hover:text-text-primary transition-colors
                   font-[DM_Mono] text-sm cursor-pointer"
      >
        &larr; Back
      </button>

      <div className="w-full max-w-md">
        {/* Header */}
        <h1 className="font-[Cinzel] text-3xl text-gold-gradient text-center mb-2">
          {mode === 'VS_BOTS' ? 'VS AI Bots' : 'Local 2-Player'}
        </h1>
        <p className="text-text-muted text-center text-sm mb-10">
          Configure your game settings
        </p>

        <div className="space-y-6">
          {/* Starting Chips */}
          <div>
            <label className="block font-[DM_Mono] text-text-secondary text-xs mb-2 tracking-wider">
              STARTING CHIPS
            </label>
            <div className="flex gap-2">
              {[500, 1000, 2000, 5000].map(amount => (
                <button
                  key={amount}
                  onClick={() => setStartingChips(amount)}
                  className={`flex-1 py-3 rounded-md font-[DM_Mono] text-sm transition-all cursor-pointer
                    ${startingChips === amount
                      ? 'bg-gold-primary/20 border border-gold-primary text-gold-light'
                      : 'bg-noir-card border border-noir-border text-text-muted hover:border-gold-muted'
                    }`}
                >
                  {amount.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Blinds */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block font-[DM_Mono] text-text-secondary text-xs mb-2 tracking-wider">
                SMALL BLIND
              </label>
              <div className="flex gap-2">
                {[5, 10, 25, 50].map(amount => (
                  <button
                    key={amount}
                    onClick={() => {
                      setSmallBlind(amount);
                      setBigBlind(amount * 2);
                    }}
                    className={`flex-1 py-2 rounded-md font-[DM_Mono] text-xs transition-all cursor-pointer
                      ${smallBlind === amount
                        ? 'bg-gold-primary/20 border border-gold-primary text-gold-light'
                        : 'bg-noir-card border border-noir-border text-text-muted hover:border-gold-muted'
                      }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1">
              <label className="block font-[DM_Mono] text-text-secondary text-xs mb-2 tracking-wider">
                BIG BLIND
              </label>
              <div className="py-2 bg-noir-card border border-noir-border rounded-md text-center
                              font-[DM_Mono] text-gold-light text-sm">
                {bigBlind}
              </div>
            </div>
          </div>

          {/* Bot Count (VS_BOTS only) */}
          {mode === 'VS_BOTS' && (
            <div>
              <label className="block font-[DM_Mono] text-text-secondary text-xs mb-2 tracking-wider">
                NUMBER OF OPPONENTS
              </label>
              <div className="flex gap-2">
                {[2, 3].map(count => (
                  <button
                    key={count}
                    onClick={() => setBotCount(count)}
                    className={`flex-1 py-3 rounded-md font-[DM_Mono] text-sm transition-all cursor-pointer
                      ${botCount === count
                        ? 'bg-gold-primary/20 border border-gold-primary text-gold-light'
                        : 'bg-noir-card border border-noir-border text-text-muted hover:border-gold-muted'
                      }`}
                  >
                    {count} Bots
                  </button>
                ))}
              </div>
              <div className="mt-2 text-text-muted text-xs">
                {botCount === 2
                  ? 'Viktor (tight-aggressive) & Luna (loose-tricky)'
                  : 'Viktor (tight-aggressive), Luna (loose-tricky) & Rex (passive)'}
              </div>
            </div>
          )}

          {/* Start Button */}
          <button
            onClick={handleStart}
            className="w-full py-4 mt-4 bg-gradient-to-r from-gold-dark via-gold-primary to-gold-dark
                       text-noir-bg font-[Cinzel] font-bold text-lg rounded-md
                       hover:shadow-[0_0_30px_rgba(201,168,76,0.3)] transition-all btn-press cursor-pointer"
          >
            Deal Me In
          </button>
        </div>
      </div>
    </div>
  );
}
