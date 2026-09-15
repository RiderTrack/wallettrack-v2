/// <reference types="vite/client" />

// F9.1 · Worker de pdfjs como import de Vite (?worker&inline lo
// embebe como blob en un chunk aparte — funciona offline en el
// APK WebView). Solo tipos; Vite lo compila solo.
declare module 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline' {
  const WorkerConstructor: new () => Worker;
  export default WorkerConstructor;
}
