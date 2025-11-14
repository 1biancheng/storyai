/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// This service manages the import and export of all application data
// to provide a comprehensive backup and restore functionality.

const APP_DATA_PREFIXES = [
    'storyWeaver',
    'theme',
    'aiAssistantPrompts',
];

/**
 * Gathers all relevant application data from localStorage.
 * @returns An object containing all data.
 */
const getAllData = (): Record<string, string> => {
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && APP_DATA_PREFIXES.some(prefix => key.startsWith(prefix))) {
            const value = localStorage.getItem(key);
            if (value) {
                data[key] = value;
            }
        }
    }
    return data;
};

/**
 * Exports all application data to a single JSON file and triggers a download.
 */
export const exportAllData = () => {
    try {
        const allData = getAllData();
        if (Object.keys(allData).length === 0) {
            alert("No data to export.");
            return;
        }

        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, "");
        a.download = `storyweaver_backup_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Failed to export data:", error);
        alert(`Data export failed: ${(error as Error).message}`);
    }
};

/**
 * Imports data from a JSON string, overwriting all existing application data.
 * @param jsonString The JSON string containing the application data.
 * @returns A promise that resolves on success or rejects on failure.
 */
export const importAllData = (jsonString: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            const dataToImport = JSON.parse(jsonString);
            if (typeof dataToImport !== 'object' || dataToImport === null || Array.isArray(dataToImport)) {
                throw new Error("Invalid backup file format. The file should contain a JSON object.");
            }

            const keysToImport = Object.keys(dataToImport);
            const seemsValid = keysToImport.length > 0 && keysToImport.every(key =>
                APP_DATA_PREFIXES.some(prefix => key.startsWith(prefix))
            );

            if (!seemsValid) {
                 throw new Error("The imported file does not appear to be a valid StoryWeaver backup file.");
            }

            if (window.confirm('This will overwrite all current projects, cards, and settings. This action cannot be undone. Are you sure you want to continue?')) {
                // Clear existing data
                const keysToRemove: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && APP_DATA_PREFIXES.some(prefix => key.startsWith(prefix))) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key));
                
                // Set new data
                for (const key in dataToImport) {
                    if (Object.prototype.hasOwnProperty.call(dataToImport, key)) {
                        localStorage.setItem(key, dataToImport[key]);
                    }
                }

                // Notify the app of changes
                window.dispatchEvent(new Event('storage'));
                
                // We need to reload to ensure all states are re-initialized correctly
                alert("Data imported successfully. The application will now reload.");
                window.location.reload();
                
                resolve();
            } else {
                reject(new Error('User cancelled the import.'));
            }

        } catch (error) {
            reject(error);
        }
    });
};

/**
 * Clears all application data from localStorage after confirmation.
 */
export const clearAllData = () => {
     if (window.confirm('WARNING: This will permanently delete all projects, cards, settings, and other data from your browser. This action cannot be undone. Are you sure you wish to proceed?')) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && APP_DATA_PREFIXES.some(prefix => key.startsWith(prefix))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Notify the app of changes
        window.dispatchEvent(new Event('storage'));

        alert("All application data has been cleared. The application will now reload.");
        window.location.reload();
     }
}