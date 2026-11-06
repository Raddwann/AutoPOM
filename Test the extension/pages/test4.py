"""
Generated Standalone Selenium Python Test Script by AutoPOM
"""
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


def test_test4_scenario():
    driver = webdriver.Chrome()
    wait = WebDriverWait(driver, 10)
    try:
        # 1. Navigate to target URL
        driver.get("http://localhost:8000/")

        # Click: btn_01CatalogButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='01 Catalog']")))
        element.click()

        # Click: importVendorCutSheetsButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Import Vendor Cut-Sheets']")))
        element.click()

        # Click: addCustomEquipmentSpecButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Add Custom Equipment Spec']")))
        element.click()
        # Smart Wait: wait for network/DOM to stabilize
        wait.until(lambda d: d.execute_script("return document.readyState") == "complete")

        # Click: aiProcurementCopilotButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='AI Procurement Copilot']")))
        element.click()

        # Input: askAboutEquipmentSpecsQuotesVendorPricesOrPosEGRielloBurnerNaturalGas80kWInput
        element = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "input[placeholder=\"Ask about equipment specs, quotes, vendor prices, or POs... (e.g. 'Riello burner natural gas 80kW')\"]")))
        element.clear()
        element.send_keys("hi")

        # Click: askCopilotButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Ask Copilot']")))
        element.click()

        # Click: btn_02RatesPricesButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='02 Rates & Prices']")))
        element.click()

        # Click: btn_03SpecificationButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='03 Specification']")))
        element.click()

        # Click: btn_04ProcessSizingButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='04 Process Sizing']")))
        element.click()

        # Click: btn_05LayoutSchematicsButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='05 Layout & Schematics']")))
        element.click()

        # Click: btn_06CostingProposalButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='06 Costing & Proposal']")))
        element.click()

        # Click: btn_05LayoutSchematicsButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='05 Layout & Schematics']")))
        element.click()

        # Click: btn_04ProcessSizingButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='04 Process Sizing']")))
        element.click()

        # Click: btn_03SpecificationButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='03 Specification']")))
        element.click()

        # Click: btn_02RatesPricesButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='02 Rates & Prices']")))
        element.click()

        # Click: btn_01CatalogButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='01 Catalog']")))
        element.click()

        # Click: addCustomEquipmentSpecButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Add Custom Equipment Spec']")))
        element.click()

        # Click: importVendorCutSheetsButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Import Vendor Cut-Sheets']")))
        element.click()

        # Click: documentSources73Button
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Document Sources (73)']")))
        element.click()

        # Click: refreshCatalogButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Refresh Catalog']")))
        element.click()

        # Click: refreshCatalogButton
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Refresh Catalog']")))
        element.click()
        # Smart Wait: wait for network/DOM to stabilize
        wait.until(lambda d: d.execute_script("return document.readyState") == "complete")

    finally:
        driver.quit()
