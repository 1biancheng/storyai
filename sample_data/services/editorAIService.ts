/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as agentService from './agentService';
import type { MouseEvent } from 'react';

// Represents the state managed by the AI editor service.
interface EditorAIState {
    contextMenu: {
        visible: boolean;
        top: number;
        left: number;
        selection: { start: number; end: number; text: string } | null;
    };
    isPolishing: boolean;
}

// Module-level state, acting as a singleton.
let state: EditorAIState = {
    contextMenu: {
        visible: false,
        top: 0,
        left: 0,
        selection: null,
    },
    isPolishing: false,
};

// A list of subscribers that get notified of state changes.
let listeners: Array<(newState: EditorAIState) => void> = [];

/**
 * Updates the service state and notifies all subscribers.
 * @param newState A partial state object to merge into the current state.
 */
const setState = (newState: Partial<EditorAIState>) => {
    // Merge the new state, handling nested contextMenu object.
    state = {
        ...state,
        ...newState,
        contextMenu: {
            ...state.contextMenu,
            ...(newState.contextMenu || {}),
        },
    };
    notifyListeners();
};

/**
 * Calls all registered listener functions with the new state.
 */
const notifyListeners = () => {
    for (const listener of listeners) {
        listener(state);
    }
};

/**
 * Allows UI components to subscribe to state changes.
 * @param listener The callback function to execute on state change.
 * @returns A function to unsubscribe the listener.
 */
export const subscribe = (listener: (newState: EditorAIState) => void) => {
    listeners.push(listener);
    return () => {
        listeners = listeners.filter(l => l !== listener);
    };
};

/**
 * Returns the current state of the service.
 * @returns The current EditorAIState object.
 */
export const getState = () => state;

/**
 * Handles the context menu event on a textarea.
 * It shows the AI context menu if text is selected.
 * @param event The React MouseEvent from the textarea.
 */
export const handleContextMenu = (event: MouseEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    const textarea = event.currentTarget;
    const { selectionStart, selectionEnd } = textarea;
    const selectedText = textarea.value.substring(selectionStart, selectionEnd);

    if (selectedText.trim().length > 0) {
        setState({
            contextMenu: {
                visible: true,
                top: event.clientY,
                left: event.clientX,
                selection: { start: selectionStart, end: selectionEnd, text: selectedText },
            }
        });
    } else {
        closeContextMenu();
    }
};

/**
 * Closes the AI context menu.
 */
export const closeContextMenu = () => {
    setState({
        contextMenu: {
            ...state.contextMenu,
            visible: false,
            selection: null,
        }
    });
};

/**
 * Initiates an AI polishing request for the selected text.
 * @param customPrompt The user's instruction for polishing.
 * @param getContent A function to get the current full content of the editor.
 * @param setContent A function to set the new full content of the editor.
 * @param setScrollTop A function to store and restore the scroll position.
 * @param textarea The textarea DOM element.
 * @param modelId The optional ID of the model to use for this request.
 */
export const handlePolish = async (
    customPrompt: string,
    getContent: () => string,
    setContent: (newContent: string) => void,
    setScrollTop: (pos: number | null) => void,
    textarea: HTMLTextAreaElement | null,
    modelId?: string | null,
) => {
    if (!state.contextMenu.selection || !textarea) return;

    setState({ isPolishing: true });
    setScrollTop(textarea.scrollTop);

    const { text, start, end } = state.contextMenu.selection;

    const prompt = `根据以下指令，润色提供的文本。只返回润色后的文本，不要添加任何额外的解释或标签。\n\n指令: "${customPrompt}"\n\n原始文本: "${text}"`;

    try {
        const response = await agentService.runAgent(prompt, modelId);
        const polishedText = response.text?.trim() || text;
        const currentContent = getContent();
        const newContent = currentContent.substring(0, start) + polishedText + currentContent.substring(end);
        setContent(newContent);
    } catch (error) {
        console.error("AI polishing failed:", error);
        alert("AI润色失败。请检查您的API密钥和网络连接。");
        setScrollTop(null); // Reset scroll restoration on error
    } finally {
        setState({ isPolishing: false });
        closeContextMenu();
    }
};