import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SendHorizonal, Bot, User, LoaderCircle, Video, VideoOff, Smile, Frown, Meh } from "lucide-react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import Webcam from "react-webcam"; // Import the webcam component

// Define the structure for a chat message
interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
}

// Emotions your model can predict (adjust as needed)
type Emotion = "happy" | "sad" | "anxious" | "neutral" | "unknown" | "angry" | "disgust" | "scared" | "surprised" | "no_face_detected" | "error";

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isWebcamOn, setIsWebcamOn] = useState(true); // State to control webcam
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>("neutral"); // New state for emotion
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const webcamRef = useRef<Webcam>(null); // Ref to access the webcam

  // Your local Python backend server address
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
  
  // Set the initial greeting message
  useEffect(() => {
    setMessages([
      {
        id: Date.now(),
        text: "Hello! I'm Exam Ease. I see you've enabled your camera, which can help me understand how you're feeling. What's on your mind today?",
        sender: "bot",
      },
    ]);
  }, []);

  const handleSend = async () => {
    if (input.trim() === "" || isLoading) return;

    const userMessage: Message = { id: Date.now(), text: input, sender: "user" };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput("");
    setIsLoading(true);

    // --- NEW: Capture Image ---
    let imageSrc = null;
    if (isWebcamOn && webcamRef.current) {
      // Get a base64 screenshot from the webcam
      imageSrc = webcamRef.current.getScreenshot();
    }
    
    try {
      // Send both the user's message and the image to the backend
      const response = await axios.post(BACKEND_URL, {
        message: input,
        image: imageSrc, // Send the image data
      });

      // --- NEW: Receive both reply and emotion ---
      const botReplyText = response.data.reply;
      const detectedEmotion = response.data.emotion as Emotion;

      const botMessage: Message = {
        id: Date.now() + 1,
        text: botReplyText,
        sender: "bot",
      };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
      setCurrentEmotion(detectedEmotion); // Update the current emotion state

    } catch (error) {
      // This block runs if the server connection fails
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: Date.now() + 1,
        text: "Sorry, I'm having a little trouble connecting right now. Please try again in a moment.",
        sender: "bot",
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
      setCurrentEmotion("unknown");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleSend();
    }
  };

  // Helper function to render an icon based on the detected emotion
  const EmotionDisplay = () => {
    switch (currentEmotion) {
      case "happy":
        return <Smile className="h-4 w-4 text-green-500" />;
      case "sad":
      case "anxious":
      case "scared":
      case "disgust":
        return <Frown className="h-4 w-4 text-blue-500" />;
      case "angry":
        return <Frown className="h-4 w-4 text-red-500" />;
      default:
        return <Meh className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b p-4 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-foreground">Exam Ease Chat</h1>
          <p className="text-sm text-muted-foreground">Your personal AI buddy for managing exam stress</p>
        </div>
        <div className="flex items-center gap-2">
            <Button onClick={() => setIsWebcamOn(!isWebcamOn)} variant="outline" size="icon" className="mr-4">
              {isWebcamOn ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <EmotionDisplay />
              <span className="capitalize">{currentEmotion}</span>
            </div>
        </div>
      </header>

      {/* --- NEW: Webcam View --- */}
      {isWebcamOn && (
        <div className="relative w-full flex justify-center bg-black">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            className="w-full max-w-xs h-auto rounded-lg"
            mirrored={true}
          />
        </div>
      )}

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