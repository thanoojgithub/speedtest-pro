import { expect, By } from '@playwright/test';
import { test } from '@playwright/test';

test.describe('SpeedTest Pro End-to-End Performance Test', () => {
    
    test('should execute full speed test and verify dynamic technical details', async ({ page }) => {
        // 1. Navigate to the application
        // Using a full URL or environment variable is required for Playwright
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        await page.goto(baseUrl);

        // 2. Verify initial state: Technical section should be hidden, button should be enabled
        const startBtn = page.locator('#start-btn');
        const techSection = page.locator('#technical-section');
        const toggleBtn = page.locator('#toggle-tech');

        await expect(startBtn).toBeEnabled();
        await expect(techSection).toBeHidden();
        await expect(toggleBtn).toBeHidden();

        // 3. Start the test
        await startBtn.click();

        // 4. Verify "Testing" state
        await expect(startBtn).toBeDisabled();
        await expect(startBtn).toHaveText('TESTING...');

        // 5. Wait for the test to complete
        // We wait for the status text to say "Analysis Complete" or the button to be re-enabled
        await expect(page.locator('#status')).toHaveText('Analysis Complete', { timeout: 60000 });
        await expect(startBtn).toBeEnabled();

        // 6. Reveal technical details
        await expect(toggleBtn).toBeVisible();
        await toggleBtn.click();
        await expect(techSection).toBeVisible();

        // 7. Dynamic Validation of Technical Details
        // We use a more robust check to ensure values are populated
        const technicalMetrics = [
            '#ping', '#jitter', '#dns-ping', '#tcp-ping', 
            '#dl-ping', '#ul-ping', '#main-dl', '#main-ul'
        ];

        for (const selector of technicalMetrics) {
            const value = await page.locator(selector).innerText();
            // We allow '-' for DNS/TCP pings as they are browser-dependent and often unavailable in headless mode
            if (selector === '#dns-ping' || selector === '#tcp-ping') {
                if (value !== '-') {
                    expect(value).toMatch(/\\d+/);
                }
            } else {
                expect(value).not.toBe('-');
                expect(value).toMatch(/\\d+/);
            }
        }

        // 8. Validate Server and System Info (Non-empty)
        const infoFields = [
            '#srv-isp', '#srv-org', '#srv-ip', '#srv-loc',
            '#dev-os', '#dev-browser', '#dev-conn'
        ];

        for (const selector of infoFields) {
            const value = await page.locator(selector).innerText();
            expect(value).not.toBe('-');
            expect(value.length).toBeGreaterThan(0);
        }

        // 9. Verify Download/Upload Data received/sent
        const dataReceived = await page.locator('#dl-data').innerText();
        const dataSent = await page.locator('#ul-data').innerText();
        
        expect(dataReceived).toMatch(/\d+(\.\d+)?\s*MB/);
        expect(dataSent).toMatch(/\d+(\.\d+)?\s*MB/);
    });
});
