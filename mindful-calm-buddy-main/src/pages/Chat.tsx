import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SendHorizonal, Bot, User, LoaderCircle } from "lucide-react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

// Define the structure for a chat message
interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
}

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // The address of your local Python backend server
  const BACKEND_URL = "http://127.0.0.1:5000/chat";

  // Automatically scroll to the bottom when new messages are added
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);
  
  // Send the first message automatically to get the bot's greeting
  useEffect(() => {
    const getInitialGreeting = async () => {
        setIsLoading(true);
        try {
            const response = await axios.post(BACKEND_URL, { message: "start_conversation" });
            setMessages([{ id: Date.now(), text: response.data.reply, sender: "bot" }]);
        } catch (error) {
            console.error("Error fetching initial greeting:", error);
            setMessages([{ id: Date.now(), text: "Sorry, I'm having trouble connecting. Please make sure the backend server is running.", sender: "bot" }]);
        } finally {
            setIsLoading(false);
        }
    };
    getInitialGreeting();
  }, []);

  const handleSend = async () => {
    if (input.trim() === "" || isLoading) return;

    const userMessage: Message = { id: Date.now(), text: input, sender: "user" };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Send the user's message to the backend
      const response = await axios.post(BACKEND_URL, {
        message: input,
      });

      const botMessage: Message = {
        id: Date.now() + 1,
        text: response.data.reply,
        sender: "bot",
      };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: Date.now() + 1,
        text: "Sorry, I'm having a little trouble connecting right now. Please try again in a moment.",
        sender: "bot",
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b p-4 shadow-sm">
        <h1 className="text-xl font-bold text-foreground">Exam Ease Chat</h1>
        <p className="text-sm text-muted-foreground">Your personal AI buddy for managing exam stress</p>
      </header>

      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
          <div className="space-y-6">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className={`flex items-start gap-4 ${
                    message.sender === "user" ? "justify-end" : ""
                  }`}
                >
                  {message.sender === "bot" && (
                    <Avatar className="w-8 h-8 border">
                      <AvatarFallback><Bot size={18} /></AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-md rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                      message.sender === "user"
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-muted text-muted-foreground rounded-bl-none"
                    }`}
                  >
                    {message.text}
                  </div>
                  {message.sender === "user" && (
                    <Avatar className="w-8 h-8 border">
                      <AvatarFallback><User size={18} /></AvatarFallback>
                    </Avatar>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
               <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-4"
                >
                <Avatar className="w-8 h-8 border">
                  <AvatarFallback><Bot size={18} /></AvatarFallback>
                </Avatar>
                <div className="bg-muted text-muted-foreground rounded-2xl px-4 py-3 rounded-bl-none flex items-center">
                    <LoaderCircle className="animate-spin w-5 h-5" />
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>
      </main>

      <footer className="border-t p-4 bg-background">
        <div className="relative">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here..."
            className="pr-12 rounded-full"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full"
            onClick={handleSend}
            disabled={isLoading}
          >
            <SendHorizonal size={20} />
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default Chat;

