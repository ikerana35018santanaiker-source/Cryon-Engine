// Console UI System for Cryon Engine
class ConsoleUI {
    constructor() {
        this.entries = [];
        this.maxEntries = 100;
        this.filterLevel = 'all'; // 'all', 'log', 'warn', 'error'
        this.isVisible = true;
        
        this.setupConsole();
        this.overrideNativeConsole();
    }
    
    setupConsole() {
        // Create console container
        this.container = document.createElement('div');
        this.container.className = 'console-container';
        this.container.innerHTML = `
            <div class="console-header">
                <span class="console-title">Console</span>
                <div class="console-controls">
                    <button class="console-filter" data-filter="all">All</button>
                    <button class="console-filter" data-filter="log">📝 Log</button>
                    <button class="console-filter" data-filter="warn">⚠️ Warn</button>
                    <button class="console-filter" data-filter="error">❌ Error</button>
                    <button class="console-clear">Clear</button>
                    <button class="console-toggle">−</button>
                </div>
            </div>
            <div class="console-content">
                <div class="console-entries"></div>
                <div class="console-input">
                    <input type="text" placeholder="Execute JavaScript...">
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Add initial welcome message
        this.log('Cryon Engine Console initialized', 'info');
        this.log('Type JavaScript code to execute', 'info');
    }
    
    setupEventListeners() {
        // Filter buttons
        this.container.querySelectorAll('.console-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterLevel = btn.dataset.filter;
                this.updateFilterButtons();
                this.refreshEntries();
            });
        });
        
        // Clear button
        this.container.querySelector('.console-clear').addEventListener('click', () => {
            this.clear();
        });
        
        // Toggle button
        this.container.querySelector('.console-toggle').addEventListener('click', () => {
            this.toggle();
        });
        
        // Input execution
        const input = this.container.querySelector('.console-input input');
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.executeCode(input.value);
                input.value = '';
            }
        });
    }
    
    updateFilterButtons() {
        this.container.querySelectorAll('.console-filter').forEach(btn => {
            if (btn.dataset.filter === this.filterLevel) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    overrideNativeConsole() {
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;
        
        console.log = (...args) => {
            this.log(args.join(' '), 'log');
            originalLog.apply(console, args);
        };
        
        console.warn = (...args) => {
            this.log(args.join(' '), 'warn');
            originalWarn.apply(console, args);
        };
        
        console.error = (...args) => {
            this.log(args.join(' '), 'error');
            originalError.apply(console, args);
        };
    }
    
    log(message, type = 'log') {
        const entry = {
            id: Date.now() + Math.random(),
            message: message,
            type: type,
            timestamp: new Date()
        };
        
        this.entries.unshift(entry);
        
        // Keep only max entries
        if (this.entries.length > this.maxEntries) {
            this.entries.pop();
        }
        
        this.addEntryToDOM(entry);
    }
    
    addEntryToDOM(entry) {
        const entriesContainer = this.container.querySelector('.console-entries');
        const entryDiv = document.createElement('div');
        entryDiv.className = `console-entry console-${entry.type}`;
        entryDiv.innerHTML = `
            <span class="console-time">${entry.timestamp.toLocaleTimeString()}</span>
            <span class="console-message">${this.escapeHtml(entry.message)}</span>
        `;
        
        entriesContainer.insertBefore(entryDiv, entriesContainer.firstChild);
        
        // Auto-scroll if near bottom
        const shouldAutoScroll = entriesContainer.scrollHeight - entriesContainer.scrollTop <= entriesContainer.clientHeight + 100;
        if (shouldAutoScroll) {
            entriesContainer.scrollTop = 0;
        }
    }
    
    refreshEntries() {
        const entriesContainer = this.container.querySelector('.console-entries');
        entriesContainer.innerHTML = '';
        
        const filteredEntries = this.filterLevel === 'all' 
            ? this.entries 
            : this.entries.filter(e => e.type === this.filterLevel);
        
        filteredEntries.reverse().forEach(entry => {
            this.addEntryToDOM(entry);
        });
    }
    
    clear() {
        this.entries = [];
        const entriesContainer = this.container.querySelector('.console-entries');
        entriesContainer.innerHTML = '';
        this.log('Console cleared', 'info');
    }
    
    toggle() {
        this.isVisible = !this.isVisible;
        const content = this.container.querySelector('.console-content');
        const toggleBtn = this.container.querySelector('.console-toggle');
        
        if (this.isVisible) {
            content.style.display = 'block';
            toggleBtn.textContent = '−';
        } else {
            content.style.display = 'none';
            toggleBtn.textContent = '+';
        }
    }
    
    executeCode(code) {
        try {
            this.log(`> ${code}`, 'command');
            const result = eval(code);
            if (result !== undefined) {
                this.log(`← ${JSON.stringify(result, null, 2)}`, 'result');
            }
        } catch (error) {
            this.error(`Execution error: ${error.message}`);
        }
    }
    
    error(message) {
        this.log(message, 'error');
    }
    
    warn(message) {
        this.log(message, 'warn');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
