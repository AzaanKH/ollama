class ChatApp {
    constructor() {
        // DOM elements
        this.messagesContainer = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatForm = document.getElementById('chatForm');
        this.errorContainer = document.getElementById('errorContainer');
        this.themeToggle = document.getElementById('themeToggle');
        this.modelSelect = document.getElementById('modelSelect');
        this.modelDisplay = document.getElementById('modelDisplay');
        this.clearChatBtn = document.getElementById('clearChat');
        this.typingIndicator = document.getElementById('typingIndicator');
        
        // Sidebar elements
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggle = document.getElementById('sidebarToggle');
        this.mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.chatList = document.getElementById('chatList');
        
        // App state
        this.apiEndpoint = '/generate';
        this.isLoading = false;
        this.currentChatId = null;
        this.chats = {}; // Store multiple chats: { chatId: { messages: [], title: '', model: '', lastUpdated: '' } }
        this.currentModel = 'gemma3';
        
        // Initialize the app
        this.initializeEventListeners();
        this.loadTheme();
        this.loadChats();
        this.loadModelPreference();
        this.adjustTextareaHeight();
        
        // Create first chat if none exist
        if (Object.keys(this.chats).length === 0) {
            this.createNewChat();
        } else {
            // Load the most recent chat
            const chatIds = Object.keys(this.chats);
            const mostRecentId = chatIds.reduce((latest, id) => 
                this.chats[id].lastUpdated > this.chats[latest].lastUpdated ? id : latest
            );
            this.switchToChat(mostRecentId);
        }
    }
    
    initializeEventListeners() {
        // Form submission
        this.chatForm.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Input handling
        this.messageInput.addEventListener('input', () => this.adjustTextareaHeight());
        this.messageInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Model selection
        this.modelSelect.addEventListener('change', (e) => this.handleModelChange(e));
        
        // Clear current chat
        this.clearChatBtn.addEventListener('click', () => this.clearCurrentChat());
        
        // Sidebar controls
        this.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        this.mobileSidebarToggle.addEventListener('click', () => this.toggleSidebar());
        this.newChatBtn.addEventListener('click', () => this.createNewChat());
        
        // Auto-save chats every 30 seconds
        setInterval(() => this.saveChats(), 30000);
        
        // Close sidebar on mobile when clicking outside
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                if (!this.sidebar.contains(e.target) && !this.mobileSidebarToggle.contains(e.target)) {
                    this.sidebar.classList.remove('show');
                }
            }
        });
    }
    
    // Chat Management
    generateChatId() {
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    createNewChat() {
        const chatId = this.generateChatId();
        const newChat = {
            messages: [],
            title: 'New Chat',
            model: this.currentModel,
            lastUpdated: new Date().toISOString(),
            created: new Date().toISOString()
        };
        
        this.chats[chatId] = newChat;
        this.currentChatId = chatId;
        this.renderChatList();
        this.displayCurrentChat();
        this.saveChats();
    }
    
    switchToChat(chatId) {
        if (!this.chats[chatId]) return;
        
        this.currentChatId = chatId;
        this.currentModel = this.chats[chatId].model;
        this.modelSelect.value = this.currentModel;
        this.modelDisplay.textContent = `Powered by ${this.currentModel.charAt(0).toUpperCase() + this.currentModel.slice(1)}`;
        
        this.renderChatList();
        this.displayCurrentChat();
    }
    
    deleteChat(chatId) {
        if (confirm('Are you sure you want to delete this chat?')) {
            delete this.chats[chatId];
            
            // If we deleted the current chat, switch to another or create new
            if (this.currentChatId === chatId) {
                const remainingChats = Object.keys(this.chats);
                if (remainingChats.length > 0) {
                    this.switchToChat(remainingChats[0]);
                } else {
                    this.createNewChat();
                }
            }
            
            this.renderChatList();
            this.saveChats();
        }
    }
    
    clearCurrentChat() {
        if (!this.currentChatId) return;
        
        if (confirm('Are you sure you want to clear this chat?')) {
            this.chats[this.currentChatId].messages = [];
            this.chats[this.currentChatId].title = 'New Chat';
            this.chats[this.currentChatId].lastUpdated = new Date().toISOString();
            
            this.displayCurrentChat();
            this.renderChatList();
            this.saveChats();
        }
    }
    
    updateChatTitle(chatId, firstMessage) {
        // Generate title from first message (first 30 characters)
        const title = firstMessage.length > 30 
            ? firstMessage.substring(0, 30) + '...'
            : firstMessage;
        
        this.chats[chatId].title = title;
        this.renderChatList();
    }
    
    displayCurrentChat() {
        if (!this.currentChatId || !this.chats[this.currentChatId]) {
            this.messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <h2>Welcome to Ollama Chat! 👋</h2>
                    <p>Start a conversation by typing a message below. Your chat history will be saved automatically.</p>
                </div>
            `;
            return;
        }
        
        const currentChat = this.chats[this.currentChatId];
        this.messagesContainer.innerHTML = '';
        
        if (currentChat.messages.length === 0) {
            this.messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <h2>Welcome to Ollama Chat! 👋</h2>
                    <p>Start a conversation by typing a message below. Your chat history will be saved automatically.</p>
                </div>
            `;
        } else {
            currentChat.messages.forEach(message => {
                if (message.type === 'system') {
                    this.displaySystemMessage(message.content, message.timestamp);
                } else {
                    this.displayMessage(message.content, message.sender, message.timestamp, false);
                }
            });
        }
        
        this.scrollToBottom();
    }
    
    renderChatList() {
        const chatIds = Object.keys(this.chats).sort((a, b) => 
            new Date(this.chats[b].lastUpdated) - new Date(this.chats[a].lastUpdated)
        );
        
        if (chatIds.length === 0) {
            this.chatList.innerHTML = `
                <div class="empty-chats">
                    <p>No previous chats</p>
                    <small>Start a new conversation to see it here</small>
                </div>
            `;
            return;
        }
        
        this.chatList.innerHTML = '';
        
        chatIds.forEach(chatId => {
            const chat = this.chats[chatId];
            const chatItem = document.createElement('div');
            chatItem.className = `chat-item ${chatId === this.currentChatId ? 'active' : ''}`;
            
            const lastMessage = chat.messages.length > 0 
                ? chat.messages[chat.messages.length - 1].content 
                : 'No messages yet';
            
            const preview = lastMessage.length > 50 
                ? lastMessage.substring(0, 50) + '...'
                : lastMessage;
            
            const date = new Date(chat.lastUpdated).toLocaleDateString();
            
            chatItem.innerHTML = `
                <div class="chat-item-title">${chat.title}</div>
                <div class="chat-item-preview">${preview}</div>
                <div class="chat-item-date">${date}</div>
            `;
            
            chatItem.addEventListener('click', () => this.switchToChat(chatId));
            
            // Add right-click context menu for deletion
            chatItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.deleteChat(chatId);
            });
            
            this.chatList.appendChild(chatItem);
        });
    }
    
    // Sidebar Management
    toggleSidebar() {
        if (window.innerWidth <= 768) {
            // Mobile: toggle show class
            this.sidebar.classList.toggle('show');
        } else {
            // Desktop: toggle collapsed class
            this.sidebar.classList.toggle('collapsed');
        }
    }
    
    // Theme Management
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }
    
    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
    
    // Model Management
    handleModelChange(e) {
        this.currentModel = e.target.value;
        this.modelDisplay.textContent = `Powered by ${this.currentModel.charAt(0).toUpperCase() + this.currentModel.slice(1)}`;
        localStorage.setItem('selectedModel', this.currentModel);
        
        // Update current chat's model
        if (this.currentChatId && this.chats[this.currentChatId]) {
            this.chats[this.currentChatId].model = this.currentModel;
            this.saveChats();
        }
        
        // Add system message about model change
        if (this.currentChatId && this.chats[this.currentChatId].messages.length > 0) {
            this.addSystemMessage(`Switched to ${this.currentModel}`);
        }
    }
    
    loadModelPreference() {
        const savedModel = localStorage.getItem('selectedModel');
        if (savedModel) {
            this.currentModel = savedModel;
            this.modelSelect.value = savedModel;
            this.modelDisplay.textContent = `Powered by ${savedModel.charAt(0).toUpperCase() + savedModel.slice(1)}`;
        }
    }
    
    // Chat Persistence
    saveChats() {
        localStorage.setItem('ollama_chats', JSON.stringify(this.chats));
        localStorage.setItem('current_chat_id', this.currentChatId);
    }
    
    loadChats() {
        const savedChats = localStorage.getItem('ollama_chats');
        const savedCurrentId = localStorage.getItem('current_chat_id');
        
        if (savedChats) {
            try {
                this.chats = JSON.parse(savedChats);
                this.currentChatId = savedCurrentId;
                this.renderChatList();
            } catch (error) {
                console.error('Error loading chats:', error);
                this.chats = {};
                this.currentChatId = null;
            }
        }
    }
    
    // Input Handling
    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSubmit(e);
        }
    }
    
    adjustTextareaHeight() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 150) + 'px';
    }
    
    // Message Handling
    async handleSubmit(e) {
        e.preventDefault();
        
        const message = this.messageInput.value.trim();
        if (!message || this.isLoading) return;
        
        // Ensure we have a current chat
        if (!this.currentChatId) {
            this.createNewChat();
        }
        
        this.clearError();
        
        // Add user message to current chat
        const userMessage = {
            content: message,
            sender: 'user',
            timestamp: new Date().toISOString()
        };
        
        this.chats[this.currentChatId].messages.push(userMessage);
        this.chats[this.currentChatId].lastUpdated = new Date().toISOString();
        
        // Update chat title if this is the first message
        if (this.chats[this.currentChatId].messages.length === 1) {
            this.updateChatTitle(this.currentChatId, message);
        }
        
        this.addMessage(message, 'user');
        
        // Clear input and prepare for response
        this.messageInput.value = '';
        this.adjustTextareaHeight();
        this.setLoading(true);
        
        try {
            const response = await this.sendMessageToBackend();
            
            // Add bot response to current chat
            const botMessage = {
                content: response,
                sender: 'bot',
                timestamp: new Date().toISOString()
            };
            
            this.chats[this.currentChatId].messages.push(botMessage);
            this.chats[this.currentChatId].lastUpdated = new Date().toISOString();
            
            this.addMessage(response, 'bot');
            
            // Save updated chats and refresh list
            this.saveChats();
            this.renderChatList();
            
        } catch (error) {
            this.showError('Failed to get response from server. Please check if the backend is running.');
            console.error('Chat error:', error);
        } finally {
            this.setLoading(false);
        }
    }
    
    async sendMessageToBackend() {
        if (!this.currentChatId) return 'Error: No active chat';
        
        // Build conversation context from current chat
        const conversationContext = this.buildConversationContext();
        
        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_message: conversationContext,
                model: this.currentModel
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        return data.response || 'No response received';
    }
    
    buildConversationContext() {
        if (!this.currentChatId || !this.chats[this.currentChatId]) {
            return '';
        }
        
        const currentChat = this.chats[this.currentChatId];
        let context = '';
        
        // Include last 10 messages for context (adjust as needed)
        const recentMessages = currentChat.messages.slice(-10);
        
        recentMessages.forEach(msg => {
            if (msg.sender === 'user') {
                context += `Human: ${msg.content}\n`;
            } else if (msg.sender === 'bot') {
                context += `Assistant: ${msg.content}\n`;
            }
        });
        
        // For single message, just return the content
        if (recentMessages.length === 1 && recentMessages[0].sender === 'user') {
            return recentMessages[0].content;
        }
        
        return context.trim();
    }
    
    addMessage(content, sender) {
        const timestamp = new Date().toISOString();
        this.displayMessage(content, sender, timestamp, true);
    }
    
    displayMessage(content, sender, timestamp, animate = true) {
        // Remove welcome message if it exists
        const welcomeMessage = this.messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        if (animate) {
            messageDiv.style.opacity = '0';
        }
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = sender === 'user' ? 'You' : 'AI';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Handle line breaks in message content
        const formattedContent = content.replace(/\n/g, '<br>');
        messageContent.innerHTML = formattedContent;
        
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        const displayTime = new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        messageTime.textContent = displayTime;
        messageContent.appendChild(messageTime);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        
        this.messagesContainer.appendChild(messageDiv);
        
        if (animate) {
            // Trigger animation
            requestAnimationFrame(() => {
                messageDiv.style.opacity = '1';
            });
        }
        
        this.scrollToBottom();
    }
    
    addSystemMessage(content) {
        if (!this.currentChatId) return;
        
        const timestamp = new Date().toISOString();
        const systemMessage = {
            content,
            type: 'system',
            timestamp
        };
        
        this.chats[this.currentChatId].messages.push(systemMessage);
        this.chats[this.currentChatId].lastUpdated = new Date().toISOString();
        this.displaySystemMessage(content, timestamp);
        this.saveChats();
    }
    
    displaySystemMessage(content, timestamp) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message';
        messageDiv.style.cssText = `
            text-align: center;
            font-size: 12px;
            color: var(--text-muted);
            margin: 10px 0;
            padding: 8px 16px;
            background: rgba(107, 114, 128, 0.1);
            border-radius: 12px;
            border: 1px solid rgba(107, 114, 128, 0.2);
        `;
        
        const displayTime = new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        messageDiv.textContent = `${content} at ${displayTime}`;
        
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    // Loading and UI States
    setLoading(loading) {
        this.isLoading = loading;
        this.sendButton.disabled = loading;
        this.messageInput.disabled = loading;
        
        if (loading) {
            this.typingIndicator.classList.add('show');
            this.scrollToBottom();
        } else {
            this.typingIndicator.classList.remove('show');
        }
    }
    
    showError(message) {
        this.errorContainer.innerHTML = `
            <div class="error-message">
                ⚠️ ${message}
            </div>
        `;
        setTimeout(() => this.clearError(), 10000);
    }
    
    clearError() {
        this.errorContainer.innerHTML = '';
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }, 100);
    }
    
    // Utility Methods
    exportChat(chatId) {
        if (!this.chats[chatId]) return;
        
        const chat = this.chats[chatId];
        const dataStr = JSON.stringify(chat, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${chat.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
    }
    
    exportAllChats() {
        const dataStr = JSON.stringify(this.chats, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `all_chats_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
    }
}

// Initialize the chat app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + N for new chat
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            window.chatApp.createNewChat();
        }
        
        // Ctrl/Cmd + K to clear current chat
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            window.chatApp.clearCurrentChat();
        }
        
        // Ctrl/Cmd + D to toggle dark mode
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            window.chatApp.toggleTheme();
        }
        
        // Ctrl/Cmd + B to toggle sidebar
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            window.chatApp.toggleSidebar();
        }
    });
});

// Handle window resize for responsive sidebar
window.addEventListener('resize', () => {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth > 768) {
        sidebar.classList.remove('show');
    }
});