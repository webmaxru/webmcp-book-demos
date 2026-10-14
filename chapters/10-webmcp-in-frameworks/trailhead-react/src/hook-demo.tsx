// Exercises Listing 10.1 (useAgentTool) on its own page: mount, unmount, metadata change, latest state.
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useAgentTool } from './agent/use-agent-tool';

function Greeter({ language }: { language: 'en' | 'nb' }) {
  const [clicks, setClicks] = useState(0);
  useAgentTool({
    name: 'get_greeting',
    description: language === 'en' ? 'Get a greeting from Trailhead.' : 'Få en hilsen fra Trailhead.',
    annotations: { readOnlyHint: true },
    execute: () => ({ greeting: language === 'en' ? 'Hello' : 'Hei', clicks }),
  });
  return <button type="button" id="click" onClick={() => setClicks((c) => c + 1)}>Clicked {clicks}</button>;
}

function Demo() {
  const [mounted, setMounted] = useState(true);
  const [language, setLanguage] = useState<'en' | 'nb'>('en');
  return (
    <>
      <button type="button" id="toggle" onClick={() => setMounted((m) => !m)}>{mounted ? 'Unmount' : 'Mount'}</button>
      <button type="button" id="language" onClick={() => setLanguage((l) => (l === 'en' ? 'nb' : 'en'))}>Language: {language}</button>
      {mounted && <Greeter language={language} />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Demo /></StrictMode>);
