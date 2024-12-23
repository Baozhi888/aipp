import React, { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen } from "@tauri-apps/api/event";
import "./styles/AskWindow.css";
import ReactMarkdown, { Components } from "react-markdown";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";

import Copy from "./assets/copy.svg?react";
import Ok from "./assets/ok.svg?react";
import OpenFullUI from "./assets/open-fullui.svg?react";
import Setting from "./assets/setting.svg?react";
import Add from "./assets/add.svg?react";
import AskWindowPrepare from "./components/AskWindowPrepare";
import AskAIHint from "./components/AskAIHint";
import IconButton from "./components/IconButton";
import { throttle } from "lodash";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import CodeBlock from "./components/CodeBlock";
import useFileManagement from "./hooks/useFileManagement";
import InputArea from "./components/conversation/InputArea";
const appWindow = getCurrentWebviewWindow();

interface AiResponse {
    conversation_id: number;
    add_message_id: number;
}
interface CustomComponents extends Components {
    antthinking: React.ElementType;
}

interface AiResponse {
    conversation_id: number;
    add_message_id: number;
}
interface CustomComponents extends Components {
    antthinking: React.ElementType;
}

function AskWindow() {
    const [query, setQuery] = useState<string>("");
    const [response, setResponse] = useState<string>("");
    const [messageId, setMessageId] = useState<number>(-1);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [aiIsResponsing, setAiIsResponsing] = useState<boolean>(false);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [selectedText, setSelectedText] = useState<string>("");

    let unsubscribe: Promise<() => void> | null = null;

    useEffect(() => {
        invoke<string>("get_selected_text_api").then((text) => {
            console.log("get_selected_text_api", text);
            setSelectedText(text);
        });

        listen<string>("get_selected_text_event", (event) => {
            console.log("get_selected_text_event", event.payload);
            setSelectedText(event.payload);
        });
    }, []);

    const handleSubmit = () => {
        if (aiIsResponsing) {
            return;
        }
        setAiIsResponsing(true);
        setResponse("");
        try {
            invoke<AiResponse>("ask_ai", {
                request: {
                    prompt: query,
                    conversation_id: "",
                    assistant_id: 1,
                },
            }).then((res) => {
                setMessageId(res.add_message_id);

                console.log("ask ai response", res);
                if (unsubscribe) {
                    console.log("Unsubscribing from previous event listener");
                    unsubscribe.then((f) => f());
                }

                console.log(
                    "Listening for response",
                    `message_${res.add_message_id}`,
                );
                unsubscribe = listen(
                    `message_${res.add_message_id}`,
                    (event) => {
                        const payload = event.payload as string;
                        if (payload !== "Tea::Event::MessageFinish") {
                            setResponse(payload);
                        } else {
                            setAiIsResponsing(false);
                        }
                    },
                );
            });
        } catch (error) {
            console.error("Error:", error);
            setResponse("An error occurred while processing your request.");
        }
    };

    const onSend = throttle(() => {
        if (aiIsResponsing) {
            console.log("Cancelling AI");
            invoke("cancel_ai", { messageId }).then(() => {
                setAiIsResponsing(false);
            });
        } else {
            console.log("Sending query to AI");
            handleSubmit();
        }
    }, 200);

    useEffect(() => {
        const handleShortcut = async (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                console.log("Closing window");
                await appWindow.hide();
            } else if (event.key === "i" && event.ctrlKey) {
                await openChatUI();
                await appWindow.hide();
            }
        };

        if (inputRef.current) {
            inputRef.current.focus();
        }

        window.addEventListener("keydown", handleShortcut);

        return () => {
            window.removeEventListener("keydown", handleShortcut);
            if (unsubscribe) {
                unsubscribe.then((f) => f());
            }
        };
    }, []);

    const openConfig = async () => {
        await invoke("open_config_window");
    };

    const openChatUI = async () => {
        await invoke("open_chat_ui_window");
    };

    const handleArtifact = useCallback((lang: string, inputStr: string) => {
        invoke("run_artifacts", { lang, inputStr }).then((res) => {
            console.log(res);
        });
    }, []);

    const startNewConversation = () => {
        setQuery("");
        setResponse("");
        setMessageId(-1);
        setAiIsResponsing(false);
    };

    const { fileInfoList, handleChooseFile, handleDeleteFile, handlePaste } =
        useFileManagement();

    return (
        <div className="ask-window">
            <div className="chat-container" data-tauri-drag-region>
                <InputArea
                    inputText={query}
                    setInputText={setQuery}
                    fileInfoList={fileInfoList}
                    handleChooseFile={handleChooseFile}
                    handleDeleteFile={handleDeleteFile}
                    handlePaste={handlePaste}
                    handleSend={onSend}
                    aiIsResponsing={aiIsResponsing}
                    placement="top"
                />
                <div className="response">
                    {messageId !== -1 ? (
                        response == "" ? (
                            <AskAIHint />
                        ) : (
                            <ReactMarkdown
                                children={response}
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[rehypeRaw, rehypeKatex]}
                                components={
                                    {
                                        code({
                                            node,
                                            className,
                                            children,
                                            ref,
                                            ...props
                                        }) {
                                            const match = /language-(\w+)/.exec(
                                                className || "",
                                            );
                                            return match ? (
                                                <CodeBlock
                                                    language={match[1]}
                                                    onCodeRun={handleArtifact}
                                                >
                                                    {String(children).replace(
                                                        /\n$/,
                                                        "",
                                                    )}
                                                </CodeBlock>
                                            ) : (
                                                <code
                                                    {...props}
                                                    ref={ref}
                                                    className={className}
                                                >
                                                    {children}
                                                </code>
                                            );
                                        },
                                        antthinking({ children }) {
                                            return (
                                                <div>
                                                    <div
                                                        className="llm-thinking-badge"
                                                        title={children}
                                                        data-thinking={children}
                                                    >
                                                        思考...
                                                    </div>
                                                </div>
                                            );
                                        },
                                    } as CustomComponents
                                }
                            />
                        )
                    ) : (
                        <AskWindowPrepare selectedText={selectedText} />
                    )}
                </div>
                <div className="tools" data-tauri-drag-region>
                    {messageId !== -1 && !aiIsResponsing && (
                        <IconButton
                            icon={<Add fill="black" />}
                            onClick={startNewConversation}
                        />
                    )}
                    {messageId !== -1 && !aiIsResponsing ? (
                        <IconButton
                            icon={
                                copySuccess ? (
                                    <Ok fill="black" />
                                ) : (
                                    <Copy fill="black" />
                                )
                            }
                            onClick={() => {
                                writeText(response);
                                setCopySuccess(true);
                                setTimeout(() => {
                                    setCopySuccess(false);
                                }, 1500);
                            }}
                        />
                    ) : null}

                    <IconButton
                        icon={<OpenFullUI fill="black" />}
                        onClick={openChatUI}
                    />
                    <IconButton
                        icon={<Setting fill="black" />}
                        onClick={openConfig}
                    />
                </div>
            </div>
        </div>
    );
}

export default AskWindow;
