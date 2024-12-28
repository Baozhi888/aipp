import React, { useRef, useEffect, useState, useCallback } from "react";
import "../../styles/InputArea.css";
import CircleButton from "../CircleButton";
import Add from "../../assets/add.svg?react";
import Stop from "../../assets/stop.svg?react";
import UpArrow from "../../assets/up-arrow.svg?react";
import Delete from "../../assets/delete.svg?react";
import Text from "../../assets/text.svg?react";
import { AttachmentType, FileInfo } from "../../data/Conversation";
import IconButton from "../IconButton";
import { invoke } from "@tauri-apps/api/core";
import { getCaretCoordinates } from "../../utils/caretCoordinates";
import BangCompletionList from "./BangCompletionList";

interface InputAreaProps {
    inputText: string;
    setInputText: React.Dispatch<React.SetStateAction<string>>;
    fileInfoList: FileInfo[] | null;
    handleChooseFile: () => void;
    handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
    handleDeleteFile: (fileId: number) => void;
    handleSend: () => void;
    aiIsResponsing: boolean;
    placement?: "top" | "bottom";
}

const InputArea: React.FC<InputAreaProps> = React.memo(
    ({
        inputText,
        setInputText,
        fileInfoList,
        handleChooseFile,
        handlePaste,
        handleDeleteFile,
        handleSend,
        aiIsResponsing,
        placement = "bottom",
    }) => {
        // 图片区域的高度
        const IMAGE_AREA_HEIGHT = 110;
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const [initialHeight, setInitialHeight] = useState<number | null>(null);
        const [bangListVisible, setBangListVisible] = useState<boolean>(false);
        const [bangList, setBangList] = useState<string[]>([]);
        const [originalBangList, setOriginalBangList] = useState<string[]>([]);
        const [cursorPosition, setCursorPosition] = useState<{
            bottom: number;
            left: number;
            top: number;
        }>({ bottom: 0, left: 0, top: 0 });
        const [selectedBangIndex, setSelectedBangIndex] = useState<number>(0);

        useEffect(() => {
            if (textareaRef.current && !initialHeight) {
                setInitialHeight(textareaRef.current.scrollHeight);
            }
            adjustTextareaHeight();
        }, [inputText, initialHeight]);

        useEffect(() => {
            invoke<string[]>("get_bang_list").then((bangList) => {
                setBangList(bangList);
                setOriginalBangList(bangList);
            });
        }, []);

        useEffect(() => {
            const handleSelectionChange = () => {
                if (textareaRef.current) {
                    const cursorPosition = textareaRef.current.selectionStart;
                    const value = textareaRef.current.value;
                    const bangIndex = Math.max(
                        value.lastIndexOf("!", cursorPosition - 1),
                        value.lastIndexOf("！", cursorPosition - 1),
                    );

                    if (bangIndex !== -1 && bangIndex < cursorPosition) {
                        const bangInput = value
                            .substring(bangIndex + 1, cursorPosition)
                            .toLowerCase();
                        const filteredBangs = originalBangList.filter(
                            ([bang]) =>
                                bang.toLowerCase().startsWith(bangInput),
                        );

                        if (filteredBangs.length > 0) {
                            setBangList(filteredBangs);
                            setSelectedBangIndex(0);
                            setBangListVisible(true);

                            const cursorCoords = getCaretCoordinates(
                                textareaRef.current,
                                bangIndex + 1,
                            );
                            const rect =
                                textareaRef.current.getBoundingClientRect();
                            const style = window.getComputedStyle(
                                textareaRef.current,
                            );
                            const paddingTop = parseFloat(style.paddingTop);
                            const paddingBottom = parseFloat(
                                style.paddingBottom,
                            );
                            const textareaHeight = parseFloat(style.height);

                            const inputAreaRect = document
                                .querySelector(".input-area")!
                                .getBoundingClientRect();
                            const left =
                                rect.left -
                                inputAreaRect.left +
                                cursorCoords.cursorLeft;

                            if (placement === "top") {
                                const top =
                                    rect.top +
                                    rect.height +
                                    Math.min(
                                        textareaHeight,
                                        cursorCoords.cursorTop,
                                    ) -
                                    paddingTop -
                                    paddingBottom;
                                setCursorPosition({ bottom: 0, left, top });
                            } else {
                                const bottom =
                                    inputAreaRect.top -
                                    rect.top -
                                    cursorCoords.cursorTop +
                                    10 +
                                    (textareaRef.current.scrollHeight -
                                        textareaRef.current.clientHeight);
                                setCursorPosition({ bottom, left, top: 0 });
                            }
                        } else {
                            setBangListVisible(false);
                        }
                    } else {
                        setBangListVisible(false);
                    }
                }
            };

            document.addEventListener("selectionchange", handleSelectionChange);
            return () => {
                document.removeEventListener(
                    "selectionchange",
                    handleSelectionChange,
                );
            };
        }, [originalBangList, placement]);

        const adjustTextareaHeight = useCallback(() => {
            const textarea = textareaRef.current;
            if (textarea && initialHeight) {
                textarea.style.height = `${initialHeight}px`;
                const maxHeight = document.documentElement.clientHeight * 0.4;
                const newHeight = Math.min(
                    Math.max(textarea.scrollHeight, initialHeight),
                    maxHeight,
                );
                textarea.style.height = `${newHeight}px`;
                console.log("fileInfoList", fileInfoList?.length != 0);
                textarea.parentElement!.style.height = `${newHeight + ((fileInfoList?.length && IMAGE_AREA_HEIGHT) || 0)}px`;
            }
        }, [initialHeight, fileInfoList]);

        const handleTextareaChange = (
            e: React.ChangeEvent<HTMLTextAreaElement>,
        ) => {
            const newValue = e.target.value;
            const cursorPosition = e.target.selectionStart;
            setInputText(newValue);

            // Check for bang input
            const bangIndex = Math.max(
                newValue.lastIndexOf("!", cursorPosition - 1),
                newValue.lastIndexOf("！", cursorPosition - 1),
            );

            if (bangIndex !== -1 && bangIndex < cursorPosition) {
                const bangInput = newValue
                    .substring(bangIndex + 1, cursorPosition)
                    .toLowerCase();
                const filteredBangs = originalBangList.filter(([bang]) =>
                    bang.toLowerCase().startsWith(bangInput),
                );

                if (filteredBangs.length > 0) {
                    setBangList(filteredBangs);
                    setSelectedBangIndex(0);
                    setBangListVisible(true);

                    // Update cursor position
                    const textarea = e.target;
                    const cursorPosition = textarea.selectionStart;
                    const cursorCoords = getCaretCoordinates(
                        textarea,
                        cursorPosition,
                    );
                    const rect = textarea.getBoundingClientRect();
                    const style = window.getComputedStyle(textarea);
                    const paddingTop = parseFloat(style.paddingTop);
                    const paddingBottom = parseFloat(style.paddingBottom);
                    const textareaHeight = parseFloat(style.height);
                    const inputAreaRect = document
                        .querySelector(".input-area")!
                        .getBoundingClientRect();

                    const left =
                        rect.left -
                        inputAreaRect.left +
                        cursorCoords.cursorLeft;

                    if (placement === "top") {
                        const top =
                            rect.top +
                            rect.height +
                            Math.min(textareaHeight, cursorCoords.cursorTop) -
                            paddingTop -
                            paddingBottom;

                        setCursorPosition({ bottom: 0, left, top });
                    } else {
                        const bottom =
                            inputAreaRect.top -
                            rect.top -
                            cursorCoords.cursorTop +
                            10 +
                            (textarea.scrollHeight - textarea.clientHeight);
                        setCursorPosition({ bottom, left, top: 0 });
                    }
                } else {
                    setBangListVisible(false);
                }
            } else {
                setBangListVisible(false);
            }
        };

        const handleKeyDownWithBang = (
            e: React.KeyboardEvent<HTMLTextAreaElement>,
        ) => {
            if (e.key === "Enter") {
                if (e.shiftKey) {
                    // Shift + Enter for new line
                    return;
                } else if (bangListVisible) {
                    // Select bang
                    e.preventDefault();
                    const selectedBang = bangList[selectedBangIndex];
                    let complete = selectedBang[1];
                    const textarea = e.currentTarget as HTMLTextAreaElement;
                    const cursorPosition = textarea.selectionStart;
                    const bangIndex = Math.max(
                        textarea.value.lastIndexOf("!", cursorPosition - 1),
                        textarea.value.lastIndexOf("！", cursorPosition - 1),
                    );

                    if (bangIndex !== -1) {
                        // 找到complete中的|的位置
                        const cursorIndex = complete.indexOf("|");
                        // 如果有|，则将光标移动到|的位置，并且移除|
                        if (cursorIndex !== -1) {
                            complete =
                                complete.substring(0, cursorIndex) +
                                complete.substring(cursorIndex + 1);
                        }

                        const beforeBang = textarea.value.substring(
                            0,
                            bangIndex,
                        );
                        const afterBang =
                            textarea.value.substring(cursorPosition);
                        setInputText(
                            beforeBang + "!" + complete + " " + afterBang,
                        );

                        // 设置光标位置
                        setTimeout(() => {
                            const newPosition =
                                bangIndex +
                                (cursorIndex === -1
                                    ? selectedBang[0].length + 2
                                    : cursorIndex + 1);
                            textarea.setSelectionRange(
                                newPosition,
                                newPosition,
                            );
                        }, 0);
                    }
                    setBangListVisible(false);
                } else {
                    // Enter for submit
                    e.preventDefault();
                    handleSend();
                }
            } else if (e.key === "Tab" && bangListVisible) {
                // Select bang
                e.preventDefault();
                const selectedBang = bangList[selectedBangIndex];
                let complete = selectedBang[1];
                const textarea = e.currentTarget as HTMLTextAreaElement;
                const cursorPosition = textarea.selectionStart;
                const bangIndex = Math.max(
                    textarea.value.lastIndexOf("!", cursorPosition - 1),
                    textarea.value.lastIndexOf("！", cursorPosition - 1),
                );

                if (bangIndex !== -1) {
                    // 找到complete中的|的位置
                    const cursorIndex = complete.indexOf("|");
                    // 如果有|，则将光标移动到|的位置，并且移除|
                    if (cursorIndex !== -1) {
                        complete =
                            complete.substring(0, cursorIndex) +
                            complete.substring(cursorIndex + 1);
                    }

                    const beforeBang = textarea.value.substring(0, bangIndex);
                    const afterBang = textarea.value.substring(cursorPosition);
                    setInputText(beforeBang + "!" + complete + " " + afterBang);

                    // 设置光标位置
                    setTimeout(() => {
                        const newPosition =
                            bangIndex +
                            (cursorIndex === -1
                                ? selectedBang[0].length + 2
                                : cursorIndex + 1);
                        textarea.setSelectionRange(newPosition, newPosition);
                    }, 0);
                }
                setBangListVisible(false);
            } else if (e.key === "ArrowUp" && bangListVisible) {
                e.preventDefault();
                setSelectedBangIndex((prevIndex) =>
                    prevIndex > 0 ? prevIndex - 1 : bangList.length - 1,
                );
            } else if (e.key === "ArrowDown" && bangListVisible) {
                e.preventDefault();
                setSelectedBangIndex((prevIndex) =>
                    prevIndex < bangList.length - 1 ? prevIndex + 1 : 0,
                );
            } else if (e.key === "Escape") {
                e.preventDefault();
                setBangListVisible(false);
            }
        };

        function scrollToSelectedBang() {
            const selectedBangElement = document.querySelector(
                ".completion-bang-container.selected",
            );
            if (selectedBangElement) {
                const parentElement = selectedBangElement.parentElement;
                if (parentElement) {
                    const parentRect = parentElement.getBoundingClientRect();
                    const selectedRect =
                        selectedBangElement.getBoundingClientRect();

                    if (selectedRect.top < parentRect.top) {
                        parentElement.scrollTop -=
                            parentRect.top - selectedRect.top;
                    } else if (selectedRect.bottom > parentRect.bottom) {
                        parentElement.scrollTop +=
                            selectedRect.bottom - parentRect.bottom;
                    }
                }
            }
        }
        useEffect(() => {
            scrollToSelectedBang();
        }, [selectedBangIndex]);

        return (
            <div className={`input-area ${placement}`}>
                <div className="input-area-textarea-container">
                    <div className="input-area-img-container">
                        {fileInfoList?.map((fileInfo) => (
                            <div
                                key={fileInfo.name + fileInfo.id}
                                className={
                                    fileInfo.type === AttachmentType.Image
                                        ? "input-area-img-wrapper"
                                        : "input-area-text-wrapper"
                                }
                            >
                                {(() => {
                                    switch (fileInfo.type) {
                                        case AttachmentType.Image:
                                            return (
                                                <img
                                                    src={fileInfo.thumbnail}
                                                    alt="缩略图"
                                                    className="input-area-img"
                                                />
                                            );
                                        case AttachmentType.Text:
                                            return [
                                                <Text fill="black" />,
                                                <span title={fileInfo.name}>
                                                    {fileInfo.name}
                                                </span>,
                                            ];
                                        case AttachmentType.PDF:
                                            return (
                                                <span title={fileInfo.name}>
                                                    {fileInfo.name} (PDF)
                                                </span>
                                            );
                                        case AttachmentType.Word:
                                            return (
                                                <span title={fileInfo.name}>
                                                    {fileInfo.name} (Word)
                                                </span>
                                            );
                                        case AttachmentType.PowerPoint:
                                            return (
                                                <span title={fileInfo.name}>
                                                    {fileInfo.name} (PowerPoint)
                                                </span>
                                            );
                                        case AttachmentType.Excel:
                                            return (
                                                <span title={fileInfo.name}>
                                                    {fileInfo.name} (Excel)
                                                </span>
                                            );
                                        default:
                                            return (
                                                <span title={fileInfo.name}>
                                                    {fileInfo.name}
                                                </span>
                                            );
                                    }
                                })()}
                                <IconButton
                                    border
                                    icon={<Delete fill="black" />}
                                    className="input-area-img-delete-button"
                                    onClick={() => {
                                        handleDeleteFile(fileInfo.id);
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    <textarea
                        ref={textareaRef}
                        className="input-area-textarea"
                        rows={1}
                        value={inputText}
                        onChange={handleTextareaChange}
                        onKeyDown={handleKeyDownWithBang}
                        onPaste={handlePaste}
                    />
                </div>

                <CircleButton
                    onClick={handleChooseFile}
                    icon={<Add fill="black" />}
                    className={`input-area-add-button ${placement}`}
                />
                <CircleButton
                    size={placement === "bottom" ? "large" : "medium"}
                    onClick={handleSend}
                    icon={
                        aiIsResponsing ? (
                            <Stop width={20} height={20} fill="white" />
                        ) : (
                            <UpArrow width={20} height={20} fill="white" />
                        )
                    }
                    primary
                    className={`input-area-send-button ${placement}`}
                />

                <BangCompletionList
                    bangListVisible={bangListVisible}
                    placement={placement}
                    cursorPosition={cursorPosition}
                    bangList={bangList}
                    selectedBangIndex={selectedBangIndex}
                    textareaRef={textareaRef}
                    setInputText={setInputText}
                    setBangListVisible={setBangListVisible}
                />
            </div>
        );
    },
);

export default InputArea;
