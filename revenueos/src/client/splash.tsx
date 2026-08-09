import './index.css';

import { navigateTo, requestExpandedMode, context } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export const Splash = () => {
  return (
    <div className="flex relative flex-col justify-center items-center min-h-screen gap-4 px-6 bg-gradient-to-b from-slate-950 via-slate-900 to-orange-950">
      <p className="text-orange-400 text-sm tracking-[0.2em] uppercase">RevenueOS</p>
      <h1 className="text-3xl font-semibold text-center text-white max-w-md">
        Help buyers where they already ask
      </h1>
      <p className="text-base text-center text-slate-300 max-w-sm">
        Installed in this community. Scans new posts hourly and leaves a genuinely
        helpful reply when the product is a real answer — never spam.
      </p>
      <button
        className="mt-2 flex items-center justify-center bg-[#d93900] text-white h-11 rounded-full px-6 hover:bg-[#c23300]"
        onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
      >
        Open dashboard
      </button>
      <p className="text-xs text-slate-500">
        Signed in as {context.username ?? 'guest'} · r/{context.subredditName ?? '…'}
      </p>
      <footer className="absolute bottom-4 flex gap-3 text-[0.8em] text-slate-500">
        <button
          className="hover:text-white"
          onClick={() => navigateTo('https://developers.reddit.com/docs')}
        >
          Docs
        </button>
        <span>|</span>
        <button
          className="hover:text-white"
          onClick={() => navigateTo('https://raiseready-seven.vercel.app')}
        >
          Portfolio
        </button>
      </footer>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
