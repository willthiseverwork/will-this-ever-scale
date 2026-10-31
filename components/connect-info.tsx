import BrandLogo from './brand-logo';

export default function ConnectInfo(){return <div className="ws-page">
 <header className="ws-header"><BrandLogo/><nav aria-label="Main navigation"><a href="/" data-analytics-id="connect_home">Tool</a><a href="/workspace" data-analytics-id="connect_workspace">Workspace</a></nav></header>
 <main className="ws-wrap"><div className="ws-heading"><div><span className="ws-eyebrow">CONNECTIONS</span><h1>Connect your tools</h1><p>Try the sample in an AI assistant, or start with your own PayPal CSV.</p></div></div>
  <div className="ws-grid">
   <section className="ws-card"><span className="ws-eyebrow">CLAUDE &amp; CODEX</span><h2>Try the sample</h2><p>Ask your assistant for a summary of a fictional shop. The sample uses made-up data.</p>
    <h3>Claude</h3><p>In Claude, open Customize → Connectors and add a custom connector. Enter this address and choose no sign-in for the sample:</p><p><code>https://app.willthiseverscale.com/mcp</code></p>
    <a className="ws-link" href="https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp?utm_source=willthiseverscale&amp;utm_medium=referral&amp;utm_campaign=connect&amp;utm_content=claude_help" data-analytics-id="connect_claude_help">Claude connector instructions</a>
    <h3>Codex</h3><p>Download and unpack the plugin package, then add it to a local marketplace using the Codex instructions. Availability can depend on your workspace settings.</p>
    <div className="ws-actions"><a className="ws-primary" href="/wtes-plugin.zip" download data-analytics-id="connect_plugin_download">Download plugin package</a><a className="ws-link" href="https://developers.openai.com/plugins/build/plugins?utm_source=willthiseverscale&amp;utm_medium=referral&amp;utm_campaign=connect&amp;utm_content=codex_help" data-analytics-id="connect_codex_help">Codex plugin instructions</a></div>
    <p className="ws-fine">Your saved workspace data is not available in the assistant yet. Account connection is still being set up.</p>
   </section>
   <section className="ws-card"><span className="ws-eyebrow">YOUR PAYPAL DATA</span><h2>Start with a CSV</h2><p>Automatic PayPal connection and daily refresh are not active yet. You can upload a PayPal CSV to analyze your data now.</p><a className="ws-primary" href="/" data-analytics-id="connect_csv">Analyze a CSV</a><p className="ws-fine">A new export is needed when you want to update your analysis.</p></section>
  </div>
 </main>
</div>;}
