import { emit, listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";


function PreviewHTMLWindow() {
    const [html, setHtml] = useState<string>("");
    useEffect(() => {
        listen<string>("preview_html", (e) => {
            console.log(e);
            setHtml(e.payload);
        });
        emit("preview-window-load");
    }, []);
    return (
        // <div dangerouslySetInnerHTML={{__html: html}}></div>
        <iframe 
            style={{
                width: "100vw",
                height: "100vh",
                border: 0,
                padding: 0,
                margin: 0
            }}
            srcDoc={html} 
            sandbox="allow-same-origin allow-scripts" 
        />
    );
}

export default PreviewHTMLWindow;