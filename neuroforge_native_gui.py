#!/usr/bin/env python3
"""
NeuroForge AI - Native macOS GUI
Simple Tkinter interface that ACTUALLY WORKS
"""

import tkinter as tk
from tkinter import scrolledtext, ttk
import requests
import json
import threading
from datetime import datetime

class NeuroForgeApp:
    def __init__(self, root):
        self.root = root
        self.root.title("🧠 NeuroForge AI")
        self.root.geometry("700x600")
        self.root.configure(bg='#1e1e1e')
        
        self.backend_url = "http://localhost:8013"
        self.is_connected = False
        
        # Configure dark theme colors
        self.bg_color = '#1e1e1e'
        self.fg_color = '#ffffff'
        self.user_bubble = '#7c3aed'  # Purple
        self.ai_bubble = '#374151'    # Gray
        
        self.setup_ui()
        self.check_connection()
        self.add_welcome_message()
    
    def setup_ui(self):
        # Header
        header_frame = tk.Frame(self.root, bg='#2d2d2d', height=60)
        header_frame.pack(fill=tk.X, padx=0, pady=0)
        header_frame.pack_propagate(False)
        
        tk.Label(
            header_frame,
            text="🧠 NeuroForge AI",
            font=('SF Pro', 18, 'bold'),
            bg='#2d2d2d',
            fg='#ffffff'
        ).pack(side=tk.LEFT, padx=20, pady=10)
        
        self.status_label = tk.Label(
            header_frame,
            text="● Checking...",
            font=('SF Pro', 11),
            bg='#2d2d2d',
            fg='#888888'
        )
        self.status_label.pack(side=tk.RIGHT, padx=20, pady=10)
        
        # Chat area
        self.chat_frame = tk.Frame(self.root, bg=self.bg_color)
        self.chat_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        self.chat_display = scrolledtext.ScrolledText(
            self.chat_frame,
            wrap=tk.WORD,
            font=('SF Pro', 13),
            bg='#2d2d2d',
            fg=self.fg_color,
            insertbackground='white',
            selectbackground='#7c3aed',
            relief=tk.FLAT,
            padx=15,
            pady=15
        )
        self.chat_display.pack(fill=tk.BOTH, expand=True)
        self.chat_display.config(state=tk.DISABLED)
        
        # Input area
        input_frame = tk.Frame(self.root, bg='#2d2d2d', height=80)
        input_frame.pack(fill=tk.X, padx=10, pady=(0, 10))
        input_frame.pack_propagate(False)
        
        # Input field with placeholder
        input_container = tk.Frame(input_frame, bg='#374151', relief=tk.FLAT)
        input_container.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(10, 10), pady=15)
        
        self.input_field = tk.Text(
            input_container,
            font=('SF Pro', 13),
            bg='#374151',
            fg='#ffffff',
            insertbackground='white',
            height=2,
            wrap=tk.WORD,
            relief=tk.FLAT,
            padx=10,
            pady=10
        )
        self.input_field.pack(fill=tk.BOTH, expand=True)
        self.input_field.bind('<Return>', self.on_enter_key)
        self.input_field.bind('<Shift-Return>', lambda e: None)  # Allow shift+enter for newline
        self.input_field.focus()
        
        # Send button
        self.send_button = tk.Button(
            input_frame,
            text="↑",
            font=('SF Pro', 20),
            bg='#7c3aed',
            fg='#ffffff',
            activebackground='#6d28d9',
            activeforeground='#ffffff',
            relief=tk.FLAT,
            width=3,
            command=self.send_message,
            cursor='hand2'
        )
        self.send_button.pack(side=tk.RIGHT, padx=(0, 10), pady=15)
    
    def add_welcome_message(self):
        welcome = """👋 Welcome to NeuroForge AI! I can help you with:

🌐 Browser automation ("Search Google for...")
💻 macOS control ("Open Calculator")
🧮 Calculations ("What's 456 × 789?")
💬 General questions

Ask me anything!"""
        self.add_message(welcome, is_user=False)
    
    def check_connection(self):
        def check():
            try:
                r = requests.get(f"{self.backend_url}/health", timeout=3)
                if r.status_code == 200:
                    self.is_connected = True
                    self.status_label.config(text="● Connected", fg='#10b981')
                else:
                    self.is_connected = False
                    self.status_label.config(text="● Disconnected", fg='#ef4444')
            except:
                self.is_connected = False
                self.status_label.config(text="● Disconnected", fg='#ef4444')
        
        threading.Thread(target=check, daemon=True).start()
    
    def on_enter_key(self, event):
        # Send on Enter, newline on Shift+Enter
        if not event.state & 0x1:  # Shift not pressed
            self.send_message()
            return 'break'  # Prevent newline
    
    def send_message(self):
        message = self.input_field.get("1.0", tk.END).strip()
        if not message:
            return
        
        # Clear input
        self.input_field.delete("1.0", tk.END)
        
        # Add user message to chat
        self.add_message(message, is_user=True)
        
        # Show loading
        self.add_message("AI is thinking...", is_user=False, is_temp=True)
        
        # Send to backend in thread
        threading.Thread(
            target=self.send_to_backend,
            args=(message,),
            daemon=True
        ).start()
    
    def send_to_backend(self, message):
        try:
            print(f"📤 Sending to {self.backend_url}/api/chat: {message}")
            
            response = requests.post(
                f"{self.backend_url}/api/chat",
                json={
                    "message": message,
                    "model": "llama3.2:3b"
                },
                timeout=60
            )
            
            print(f"📥 Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                ai_response = data.get('response', 'No response')
                print(f"✅ Got response: {ai_response[:100]}...")
                
                # Remove loading message and add real response
                self.root.after(0, lambda: self.replace_last_message(ai_response))
            else:
                error_msg = f"Error {response.status_code}: {response.text[:200]}"
                self.root.after(0, lambda: self.replace_last_message(error_msg))
        
        except Exception as e:
            error_msg = f"❌ Error: {str(e)}"
            print(f"❌ Error: {e}")
            self.root.after(0, lambda: self.replace_last_message(error_msg))
    
    def add_message(self, text, is_user=False, is_temp=False):
        self.chat_display.config(state=tk.NORMAL)
        
        # Timestamp
        timestamp = datetime.now().strftime("%H:%M")
        
        # Add spacing
        if self.chat_display.get("1.0", tk.END).strip():
            self.chat_display.insert(tk.END, "\n\n")
        
        # Add message with styling
        if is_user:
            self.chat_display.insert(tk.END, f"You ({timestamp})\n", "user_label")
            self.chat_display.insert(tk.END, text, "user_message")
        else:
            self.chat_display.insert(tk.END, f"NeuroForge AI ({timestamp})\n", "ai_label")
            if is_temp:
                self.chat_display.insert(tk.END, text, "ai_loading")
            else:
                self.chat_display.insert(tk.END, text, "ai_message")
        
        # Configure tags for styling
        self.chat_display.tag_config("user_label", foreground='#a78bfa', font=('SF Pro', 11))
        self.chat_display.tag_config("user_message", foreground='#ffffff', font=('SF Pro', 13))
        self.chat_display.tag_config("ai_label", foreground='#9ca3af', font=('SF Pro', 11))
        self.chat_display.tag_config("ai_message", foreground='#e5e7eb', font=('SF Pro', 13))
        self.chat_display.tag_config("ai_loading", foreground='#9ca3af', font=('SF Pro', 13, 'italic'))
        
        self.chat_display.see(tk.END)
        self.chat_display.config(state=tk.DISABLED)
    
    def replace_last_message(self, new_text):
        """Replace the last (loading) message with actual response"""
        self.chat_display.config(state=tk.NORMAL)
        
        # Find and delete last message (from last "NeuroForge AI" to end)
        content = self.chat_display.get("1.0", tk.END)
        last_ai_index = content.rfind("NeuroForge AI")
        
        if last_ai_index != -1:
            # Convert to Tkinter index
            lines_before = content[:last_ai_index].count('\n')
            self.chat_display.delete(f"{lines_before + 1}.0", tk.END)
        
        # Add the real response
        timestamp = datetime.now().strftime("%H:%M")
        self.chat_display.insert(tk.END, f"NeuroForge AI ({timestamp})\n", "ai_label")
        self.chat_display.insert(tk.END, new_text, "ai_message")
        
        self.chat_display.see(tk.END)
        self.chat_display.config(state=tk.DISABLED)
        
        # Refocus input
        self.input_field.focus()


if __name__ == "__main__":
    print("🚀 Launching NeuroForge AI native GUI...")
    print("Backend: http://localhost:8013")
    print("")
    
    root = tk.Tk()
    app = NeuroForgeApp(root)
    
    print("✅ GUI launched successfully!")
    print("Window is now visible - you can type and chat!")
    print("")
    
    root.mainloop()

