const path = require('path');

process.stdin.setEncoding('utf8');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
    let req;
    try {
        req = JSON.parse(input);
    } catch (e) {
        process.stdout.write(JSON.stringify({ ok: false, error: 'Invalid JSON: ' + e.message }));
        process.exit(1);
    }

    try {
        const SynzAPI = require(path.join(__dirname, 'SynzApi.js'));

        if (req.action === 'check') {
            let running = false;
            if (typeof SynzAPI.IsRobloxRunning === 'function') {
                running = SynzAPI.IsRobloxRunning();
            } else if (typeof SynzAPI.GetRobloxProcesses === 'function') {
                running = SynzAPI.GetRobloxProcesses().length > 0;
            } else if (typeof SynzAPI.GetProcesses === 'function') {
                running = SynzAPI.GetProcesses().some(p => p.toLowerCase().includes('roblox'));
            } else {
                running = true;
            }
            process.stdout.write(JSON.stringify({ ok: true, running }));
        } else if (req.action === 'execute') {
            SynzAPI.Execute(req.script);
            process.stdout.write(JSON.stringify({ ok: true }));
        } else {
            process.stdout.write(JSON.stringify({ ok: false, error: 'Unknown action' }));
        }
    } catch (e) {
        process.stdout.write(JSON.stringify({ ok: false, error: e.message }));
        process.exit(1);
    }
});
