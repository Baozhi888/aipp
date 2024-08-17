import React from "react";
import IconButton from "../IconButton";
import Edit from "../../assets/edit.svg?react";
import Delete from "../../assets/delete.svg?react";
import { Conversation } from "../../data/Conversation";

const ConversationTitle: React.FC<{
    conversation: Conversation | undefined;
    onEdit: () => void;
    onDelete: () => void;
}> = React.memo(({ conversation, onEdit, onDelete }) => (
    <div className="conversation-title-panel">
        <div className="conversation-title-panel-text-group">
            <div className="conversation-title-panel-title">{conversation?.name}</div>
            <div className="conversation-title-panel-assistant-name">{conversation?.assistant_name}</div>
        </div>
        <div className="conversation-title-panel-button-group">
            <IconButton icon={<Edit fill="#468585" />} onClick={onEdit} border />
            <IconButton icon={<Delete fill="#468585" />} onClick={onDelete} border />
        </div>
    </div>
));

export default ConversationTitle;