document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('foodForm');
    const imageInputs = document.querySelectorAll('.image-input');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const resultsSection = document.getElementById('resultsSection');
    const WEBHOOK_URL = 'https://hook.eu2.make.com/f9p3qeahgbc36wvkxtvowtmerij9ukty';

    // 設置圖片預覽
    imageInputs.forEach(input => {
        input.addEventListener('change', function(e) {
            const preview = this.nextElementSibling;
            const file = this.files[0];
            
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.innerHTML = `<img src="${e.target.result}" alt="預覽圖">`;
                }
                reader.readAsDataURL(file);
            }
        });
    });

    // 顯示/隱藏載入中狀態
    function showLoading(show) {
        loadingOverlay.classList.toggle('hidden', !show);
    }

    // 顯示結果
    function displayResults(data) {
        const resultTitle = document.getElementById('resultTitle');
        const resultContent = document.getElementById('resultContent');
        const resultImages = document.getElementById('resultImages');

        // 確保我們處理的是陣列中的第一個對象
        const response = Array.isArray(data) ? data[0] : data;

        // 處理標題（使用 body）
        resultTitle.textContent = response.body || '處理完成';

        // 處理內文（從 Location header）
        const content = response.headers?.find(h => h.key === 'Location')?.value || '';
        resultContent.textContent = content;
        
        // 檢查是否有重定向 URL
        const redirectUrl = response.headers?.find(h => h.key === 'Redirect-URL')?.value;
        if (redirectUrl) {
            // 等待一段時間後重定向
            setTimeout(() => {
                window.location.href = redirectUrl;
            }, 3000); // 3秒後重定向
        }

        resultsSection.classList.remove('hidden');
        showLoading(false);
        
        // 滾動到結果區域
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    // 表單提交處理
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading(true);
        resultsSection.classList.add('hidden');

        // 轉換圖片為 base64
        const imagePromises = Array.from(imageInputs).map((input, index) => {
            return new Promise((resolve) => {
                const file = input.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        // 移除 base64 數據中的 MIME 類型前綴
                        const base64Data = e.target.result.split(',')[1];
                        resolve({
                            [`image${index + 1}`]: base64Data,
                            [`image${index + 1}_type`]: file.type
                        });
                    };
                    reader.readAsDataURL(file);
                } else {
                    resolve({
                        [`image${index + 1}`]: null,
                        [`image${index + 1}_type`]: null
                    });
                }
            });
        });

        try {
            const images = await Promise.all(imagePromises);
            const email = document.getElementById('email').value;
            const payload = {
                storeName: document.getElementById('storeName').value,
                address: document.getElementById('address').value,
                impression: document.getElementById('impression').value,
                email: email || null, // 如果沒有填寫則傳送 null
                ...Object.assign({}, ...images)
            };

            const now = new Date();
            const finalPayload = {
                ...payload,
                timestamp: now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + 
                          String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
                type: 'food_review'
            };

            console.log('Sending payload:', finalPayload);

            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                mode: 'cors',
                body: JSON.stringify(finalPayload)
            });
            
            console.log('Response status:', response.status);
            
            if (response.ok) {
                const responseText = await response.text();
                console.log('Response text:', responseText);
                
                let responseData;
                try {
                    // 嘗試解析 JSON
                    responseData = JSON.parse(responseText);
                    console.log('Parsed response:', responseData);
                } catch (e) {
                    console.error('JSON parse error:', e);
                    // 如果不是 JSON，則創建一個預設的回應對象
                    responseData = {
                        body: '提交成功',
                        headers: [
                            {
                                key: 'Location',
                                value: responseText
                            }
                        ]
                    };
                }
                
                displayResults(responseData);
                form.reset();
                document.querySelectorAll('.preview').forEach(preview => {
                    preview.innerHTML = '';
                });
            } else {
                const errorText = await response.text();
                console.log('Error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert(`提交時發生錯誤：${error.message}\n請檢查瀏覽器控制台以獲取更多信息。`);
        } finally {
            showLoading(false);
        }
    });
});
