import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ChatMessage, ChatResponse, ViewKey } from "@/app/types";
import { createId, createInitialMessages, parseJson } from "@/lib/utils";

type UseKnowledgeChatParams = {
  indexedDocumentsLength: number;
  selectedFolderIds: string[];
  selectedDocumentIds: string[];
  setActiveView: (view: ViewKey) => void;
};

export function useKnowledgeChat({
  indexedDocumentsLength,
  selectedFolderIds,
  selectedDocumentIds,
  setActiveView,
}: UseKnowledgeChatParams) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(createInitialMessages);
  const [isAnswering, setIsAnswering] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [isAnswering, messages]);

  const resetChat = useCallback(() => {
    setActiveView("chat");
    setChatInput("");
    setMessages(createInitialMessages());
    setIsAnswering(false);
  }, [setActiveView]);

  const submitChat = useCallback(async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const question = chatInput.trim();

    if (!question || isAnswering || indexedDocumentsLength === 0) {
      return;
    }

    setChatInput("");
    setIsAnswering(true);
    setMessages((current) => [
      ...current,
      { id: createId("user"), role: "user", content: question },
    ]);

    try {
      const data = await parseJson<ChatResponse>(
        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            selectedDocumentIds,
            selectedFolderIds,
          }),
        }),
      );

      setMessages((current) => [
        ...current,
        {
          id: createId("assistant"),
          role: "assistant",
          content: data.answer,
          documents: data.documents,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: createId("assistant"),
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Failed to answer the question.",
        },
      ]);
    } finally {
      setIsAnswering(false);
    }
  }, [
    chatInput,
    indexedDocumentsLength,
    isAnswering,
    selectedDocumentIds,
    selectedFolderIds,
  ]);

  return {
    chatInput,
    setChatInput,
    messages,
    setMessages,
    isAnswering,
    messagesEndRef,
    resetChat,
    submitChat,
  };
}
