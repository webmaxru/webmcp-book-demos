import { useEffect, useState } from 'react';

// Shows the person what the agent just did, using the toolactivated and toolcancel events.
export function AgentActivity() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = (text: string) => {
      setMessage(text);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 4000);
    };
    const onActivated = (e: WebMCP.ToolActivatedEvent) => show(`Agent is using ${e.toolName}`);
    const onCancel = (e: WebMCP.ToolCancelEvent) => show(`Agent cancelled ${e.toolName}`);
    modelContext.addEventListener('toolactivated', onActivated);
    modelContext.addEventListener('toolcancel', onCancel);
    return () => {
      clearTimeout(timer);
      modelContext.removeEventListener('toolactivated', onActivated);
      modelContext.removeEventListener('toolcancel', onCancel);
    };
  }, []);

  return message ? <p className="agent-activity" role="status">{message}</p> : null;
}
