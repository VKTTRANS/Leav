// เปลี่ยน URL ด้านล่างเป็นลิงก์ Web App ของคุณ (URL ที่ได้จากการ Deploy รอบล่าสุด)
const GAS_URL = "https://script.google.com/macros/s/AKfycbxyhWhFH-KG4FlNdGm0J_dm8_IYqjzcpEhf-SNWUzksmX8rp-NpL3LRoDaJlwfVtnHe/exec";

async function apiCall(action, args = {}) {
    const token = localStorage.getItem('sessionToken') || '';
    
    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: action, args: args, token: token }),
            // ใช้ text/plain เพื่อให้ยิงข้าม Domain (CORS) ได้โดยไม่ติด Block
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        
        return await response.json();
    } catch (error) {
        console.error("API Fetch Error:", error);
        throw new Error("เชื่อมต่อกับเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง");
    }
}