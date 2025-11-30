#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const process = require('process');

/**
 * CONFIGURATION
 * We retrieve values from Environment Variables which are populated 
 * by the MCP User Config inputs defined in the manifest.
 */
const SERVER_PORT = process.env.SERVER_PORT || '1985';
const BEARER_TOKEN = process.env.BEARER_TOKEN;

if (!BEARER_TOKEN) {
    console.error("Error: specific bearer_token is missing in environment variables.");
    process.exit(1);
}

/**
 * Find the docker binary path
 */
function getDockerPath() {
    const possiblePaths = [
        '/usr/local/bin/docker',
        '/opt/homebrew/bin/docker',
        '/usr/bin/docker',
        '/Applications/Docker.app/Contents/Resources/bin/docker'
    ];

    for (const path of possiblePaths) {
        try {
            const fs = require('fs');
            if (fs.existsSync(path)) {
                return path;
            }
        } catch (e) {
            // Continue checking
        }
    }

    // Fallback: try to find it via 'which'
    try {
        const which = execSync('which docker', { encoding: 'utf-8' }).trim();
        if (which) return which;
    } catch (e) {
        // which failed
    }

    return 'docker'; // Fallback to hoping it's in PATH
}

/**
 * START DOCKER DAEMON (macOS Specific)
 * Checks if Docker is running, launches it if not, and waits until ready.
 */
function ensureDockerIsRunning() {
    const dockerPath = getDockerPath();
    console.error(`[WebSSH] Using Docker at: ${dockerPath}`);

    try {
        // Check if docker is responsive
        execSync(`${dockerPath} info`, { stdio: 'ignore' });
        console.error("[WebSSH] Docker is already running!");
        return dockerPath;
    } catch (e) {
        console.error("[WebSSH] Docker is not running. Launching Docker for Mac...");

        try {
            execSync('open -a Docker');
        } catch (err) {
            console.error("[WebSSH] Failed to open Docker app via command line.");
            process.exit(1);
        }

        console.error("[WebSSH] Waiting for Docker Daemon to be ready...");

        // Loop until Docker is ready (timeout after ~60s)
        let retries = 30;
        while (retries > 0) {
            try {
                console.error(`[WebSSH] Checking Docker status... (${31 - retries}/30)`);
                execSync(`${dockerPath} info`, { stdio: 'ignore' });
                console.error("[WebSSH] Docker is ready!");
                return dockerPath;
            } catch (err) {
                // Wait 2 seconds before retrying
                const stop = Date.now() + 2000;
                while (Date.now() < stop) { } // Blocking sync wait
                retries--;
            }
        }
        console.error("[WebSSH] Docker failed to start in time.");
        process.exit(1);
    }
}

/**
 * MAIN EXECUTION
 */
(() => {
    // 1. Make sure Docker is ready and get its path
    const dockerPath = ensureDockerIsRunning();

    // 2. Make Docker run arguments
    const dockerArgs = [
        "run",
        "--rm",
        "--network", "host",
        "-i",
        "-e", `MCP_SERVER_URL=http://host.docker.internal:${SERVER_PORT}`,
        "-e", `MCP_AUTH=Bearer ${BEARER_TOKEN}`,
        "ghcr.io/ibm/mcp-context-forge:0.9.0",
        "python3",
        "-m",
        "mcpgateway.wrapper"
    ];

    // 3. Spawn the container with full path
    const child = spawn(dockerPath, dockerArgs, {
        stdio: ['pipe', 'pipe', 'inherit']  // stdin: pipe, stdout: pipe, stderr: inherit
    });

    // Pipe stdin/stdout for MCP protocol
    process.stdin.pipe(child.stdin);
    child.stdout.pipe(process.stdout);

    child.on('error', (err) => {
        console.error(`[WebSSH] Failed to start container: ${err.message}`);
        process.exit(1);
    });

    child.on('close', (code) => {
        process.exit(code);
    });

    // Handle process termination gracefully
    process.on('SIGINT', () => {
        child.kill('SIGTERM');
    });

    process.on('SIGTERM', () => {
        child.kill('SIGTERM');
    });
})();