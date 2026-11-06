"""
Generated Standalone Selenium Python Test Script by AutoPOM
"""
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


def test_test2_scenario():
    driver = webdriver.Chrome()
    wait = WebDriverWait(driver, 10)
    try:
        # 1. Navigate to target URL
        driver.get("http://localhost:8000/")

        # Click: btn_01CatalogButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., '01') and contains(., 'Catalog')]")))
        element.click()

        # Click: importVendorCutSheetsButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Import Vendor Cut-Sheets']")))
        element.click()

        # Click: addCustomEquipmentSpecButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Add Custom Equipment Spec']")))
        element.click()

        # Click: aiProcurementCopilotButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='AI Procurement Copilot']")))
        element.click()

        # Click: askAboutEquipmentSpecsQuotesVendorPricesOrPosEGRielloBurnerNaturalGas80kWInput
        element = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "input[placeholder=\"Ask about equipment specs, quotes, vendor prices, or POs... (e.g. 'Riello burner natural gas 80kW')\"]")))
        element.click()

        # Input: askAboutEquipmentSpecsQuotesVendorPricesOrPosEGRielloBurnerNaturalGas80kWInput
        element = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "input[placeholder=\"Ask about equipment specs, quotes, vendor prices, or POs... (e.g. 'Riello burner natural gas 80kW')\"]")))
        element.clear()
        element.send_keys("hi")

        # Click: askCopilotButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Ask Copilot']")))
        element.click()

        # Click: btn_02RatesPricesButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., '02') and contains(., 'Rates & Prices')]")))
        element.click()

        # Click: btn_03SpecificationButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., '03') and contains(., 'Specification')]")))
        element.click()

        # Click: btn_04ProcessSizingButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., '04') and contains(., 'Process Sizing')]")))
        element.click()

        # Click: btn_05LayoutSchematicsButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., '05') and contains(., 'Layout & Schematics')]")))
        element.click()

        # Click: btn_06CostingProposalButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., '06') and contains(., 'Costing & Proposal')]")))
        element.click()

        # Click: btn_05LayoutSchematicsButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., '05') and contains(., 'Layout & Schematics')]")))
        element.click()

        # Click: btn_04ProcessSizingButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., '04') and contains(., 'Process Sizing')]")))
        element.click()

        # Click: btn_03SpecificationButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., '03') and contains(., 'Specification')]")))
        element.click()

        # Click: btn_02RatesPricesButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., '02') and contains(., 'Rates & Prices')]")))
        element.click()

        # Click: btn_01CatalogButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., '01') and contains(., 'Catalog')]")))
        element.click()

        # Click: documentSources73Button
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Document Sources (73)']")))
        element.click()

        # Click: refreshCatalogButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Refresh Catalog']")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        element.click()

    finally:
        driver.quit()
