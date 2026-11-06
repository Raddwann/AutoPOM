"""
Page Object for CatalogPage
Generated from URL: http://localhost:8000/
"""
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class CatalogPage:
    """Page Object Model for CatalogPage"""

    # --- Locators ---
    BTN_01CATALOG_BUTTON = (By.XPATH, "//button[normalize-space()='01Catalog']")
    BTN_02RATES_PRICES_BUTTON = (By.XPATH, "//button[normalize-space()='02Rates & Prices']")
    BTN_03SPECIFICATION_BUTTON = (By.XPATH, "//button[normalize-space()='03Specification']")
    BTN_04PROCESS_SIZING_BUTTON = (By.XPATH, "//button[normalize-space()='04Process Sizing']")
    BTN_05LAYOUT_SCHEMATICS_BUTTON = (By.XPATH, "//button[normalize-space()='05Layout & Schematics']")
    BTN_06COSTING_PROPOSAL_BUTTON = (By.XPATH, "//button[normalize-space()='06Costing & Proposal']")
    B2F_PAINT_WITTENSTIEN_BUTTON = (By.XPATH, "//button[normalize-space()='B2F Paint(WITTENSTIEN)']")
    REFRESH_CATALOG_BUTTON = (By.XPATH, "//button[normalize-space()='Refresh Catalog']")
    DOCUMENT_SOURCES73_BUTTON = (By.XPATH, "//button[normalize-space()='Document Sources (73)']")
    IMPORT_VENDOR_CUT_SHEETS_BUTTON = (By.XPATH, "//button[normalize-space()='Import Vendor Cut-Sheets']")
    ADD_CUSTOM_EQUIPMENT_SPEC_BUTTON = (By.XPATH, "//button[normalize-space()='Add Custom Equipment Spec']")
    AI_PROCUREMENT_COPILOT_BUTTON = (By.XPATH, "//button[normalize-space()='AI Procurement Copilot']")
    FILTER_SOURCES_BY_NAME_OR_VENDOR_INPUT = (By.CSS_SELECTOR, "input[placeholder=\"Filter sources by name or vendor...\"]")
    ASK_COPILOT_BUTTON = (By.XPATH, "//button[normalize-space()='Ask Copilot']")
    DELETE_SOURCE_BUTTON = (By.XPATH, "//button[normalize-space()='Delete Source']")

    def __init__(self, driver: WebDriver, timeout: int = 10):
        self.driver = driver
        self.wait = WebDriverWait(driver, timeout)

    # --- Page Actions ---
    def click_btn01catalog_button(self):
        """Clicks the 01Catalog element."""
        element = self.wait.until(EC.element_to_be_clickable(self.BTN_01CATALOG_BUTTON))
        element.click()
        return self

    def click_btn02rates_prices_button(self):
        """Clicks the 02Rates & Prices element."""
        element = self.wait.until(EC.element_to_be_clickable(self.BTN_02RATES_PRICES_BUTTON))
        element.click()
        return self

    def click_btn03specification_button(self):
        """Clicks the 03Specification element."""
        element = self.wait.until(EC.element_to_be_clickable(self.BTN_03SPECIFICATION_BUTTON))
        element.click()
        return self

    def click_btn04process_sizing_button(self):
        """Clicks the 04Process Sizing element."""
        element = self.wait.until(EC.element_to_be_clickable(self.BTN_04PROCESS_SIZING_BUTTON))
        element.click()
        return self

    def click_btn05layout_schematics_button(self):
        """Clicks the 05Layout & Schematics element."""
        element = self.wait.until(EC.element_to_be_clickable(self.BTN_05LAYOUT_SCHEMATICS_BUTTON))
        element.click()
        return self

    def click_btn06costing_proposal_button(self):
        """Clicks the 06Costing & Proposal element."""
        element = self.wait.until(EC.element_to_be_clickable(self.BTN_06COSTING_PROPOSAL_BUTTON))
        element.click()
        return self

    def click_b2f_paint_wittenstien_button(self):
        """Clicks the B2F Paint(WITTENSTIEN) element."""
        element = self.wait.until(EC.element_to_be_clickable(self.B2F_PAINT_WITTENSTIEN_BUTTON))
        element.click()
        return self

    def click_refresh_catalog_button(self):
        """Clicks the Refresh Catalog element."""
        element = self.wait.until(EC.element_to_be_clickable(self.REFRESH_CATALOG_BUTTON))
        element.click()
        return self

    def click_document_sources73button(self):
        """Clicks the Document Sources (73) element."""
        element = self.wait.until(EC.element_to_be_clickable(self.DOCUMENT_SOURCES73_BUTTON))
        element.click()
        return self

    def click_import_vendor_cut_sheets_button(self):
        """Clicks the Import Vendor Cut-Sheets element."""
        element = self.wait.until(EC.element_to_be_clickable(self.IMPORT_VENDOR_CUT_SHEETS_BUTTON))
        element.click()
        return self

    def click_add_custom_equipment_spec_button(self):
        """Clicks the Add Custom Equipment Spec element."""
        element = self.wait.until(EC.element_to_be_clickable(self.ADD_CUSTOM_EQUIPMENT_SPEC_BUTTON))
        element.click()
        return self

    def click_ai_procurement_copilot_button(self):
        """Clicks the AI Procurement Copilot element."""
        element = self.wait.until(EC.element_to_be_clickable(self.AI_PROCUREMENT_COPILOT_BUTTON))
        element.click()
        return self

    def enter_filter_sources_by_name_or_vendor_input(self, value: str):
        """Enters text into Filter sources by name or vendor...."""
        element = self.wait.until(EC.visibility_of_element_located(self.FILTER_SOURCES_BY_NAME_OR_VENDOR_INPUT))
        element.clear()
        element.send_keys(value)
        return self

    def click_ask_copilot_button(self, index: int = 0):
        """Clicks the Ask Copilot element at given row/list index (default 0)."""
        elements = self.wait.until(EC.presence_of_all_elements_located(self.ASK_COPILOT_BUTTON))
        if index >= len(elements):
            raise IndexError(f"Index {index} out of bounds for ASK_COPILOT_BUTTON (total {len(elements)})")
        elements[index].click()
        return self

    def click_delete_source_button(self, index: int = 0):
        """Clicks the Delete Source element at given row/list index (default 0)."""
        elements = self.wait.until(EC.presence_of_all_elements_located(self.DELETE_SOURCE_BUTTON))
        if index >= len(elements):
            raise IndexError(f"Index {index} out of bounds for DELETE_SOURCE_BUTTON (total {len(elements)})")
        elements[index].click()
        return self

