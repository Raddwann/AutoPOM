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
    # --- Component: NavigationMenu ---
    CATALOG_TAB_BUTTON = (By.XPATH, "//button[normalize-space()='01Catalog']")
    RATES_PRICES_TAB_BUTTON = (By.XPATH, "//button[normalize-space()='02Rates & Prices']")
    SPECIFICATION_TAB_BUTTON = (By.XPATH, "//button[normalize-space()='03Specification']")
    PROCESS_SIZING_TAB_BUTTON = (By.XPATH, "//button[normalize-space()='04Process Sizing']")
    LAYOUT_SCHEMATICS_TAB_BUTTON = (By.XPATH, "//button[normalize-space()='05Layout & Schematics']")
    COSTING_PROPOSAL_TAB_BUTTON = (By.XPATH, "//button[normalize-space()='06Costing & Proposal']")
    # --- Component: CatalogToolbar ---
    PAINT_WITTENSTEIN_BUTTON = (By.XPATH, "//button[normalize-space()='B2F Paint(WITTENSTIEN)']")
    REFRESH_CATALOG_BUTTON = (By.XPATH, "//button[normalize-space()='Refresh Catalog']")
    DOCUMENT_SOURCES_BUTTON = (By.XPATH, "//button[normalize-space()='Document Sources (73)']")
    IMPORT_VENDOR_CUT_SHEETS_BUTTON = (By.XPATH, "//button[normalize-space()='Import Vendor Cut-Sheets']")
    ADD_CUSTOM_EQUIPMENT_SPEC_BUTTON = (By.XPATH, "//button[normalize-space()='Add Custom Equipment Spec']")
    AI_PROCUREMENT_COPILOT_BUTTON = (By.XPATH, "//button[normalize-space()='AI Procurement Copilot']")
    FILTER_SOURCES_INPUT = (By.CSS_SELECTOR, "input[placeholder=\"Filter sources by name or vendor...\"]")
    # --- Component: DocumentSourcesList ---
    ASK_COPILOT_BUTTON1 = (By.XPATH, "//button[normalize-space()='Ask Copilot']")
    DELETE_SOURCE_BUTTON1 = (By.XPATH, "//button[normalize-space()='Delete Source']")

    def __init__(self, driver: WebDriver, timeout: int = 10):
        self.driver = driver
        self.wait = WebDriverWait(driver, timeout)

    # --- Page Actions ---
    # --- Component Actions: NavigationMenu ---
    def click_catalog_tab_button(self):
        """Clicks the 01Catalog element."""
        element = self.wait.until(EC.element_to_be_clickable(self.CATALOG_TAB_BUTTON))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        element.click()
        return self

    def click_rates_prices_tab_button(self):
        """Clicks the 02Rates & Prices element."""
        element = self.wait.until(EC.element_to_be_clickable(self.RATES_PRICES_TAB_BUTTON))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        element.click()
        return self

    def click_specification_tab_button(self):
        """Clicks the 03Specification element."""
        element = self.wait.until(EC.element_to_be_clickable(self.SPECIFICATION_TAB_BUTTON))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        element.click()
        return self

    def click_process_sizing_tab_button(self):
        """Clicks the 04Process Sizing element."""
        element = self.wait.until(EC.element_to_be_clickable(self.PROCESS_SIZING_TAB_BUTTON))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        element.click()
        return self

    def click_layout_schematics_tab_button(self):
        """Clicks the 05Layout & Schematics element."""
        element = self.wait.until(EC.element_to_be_clickable(self.LAYOUT_SCHEMATICS_TAB_BUTTON))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        element.click()
        return self

    def click_costing_proposal_tab_button(self):
        """Clicks the 06Costing & Proposal element."""
        element = self.wait.until(EC.element_to_be_clickable(self.COSTING_PROPOSAL_TAB_BUTTON))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        element.click()
        return self

    # --- Component Actions: CatalogToolbar ---
    def click_paint_wittenstein_button(self):
        """Clicks the B2F Paint(WITTENSTIEN) element."""
        element = self.wait.until(EC.element_to_be_clickable(self.PAINT_WITTENSTEIN_BUTTON))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        element.click()
        return self

    def click_refresh_catalog_button(self):
        """Clicks the Refresh Catalog element."""
        element = self.wait.until(EC.element_to_be_clickable(self.REFRESH_CATALOG_BUTTON))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        element.click()
        return self

    def click_document_sources_button(self):
        """Clicks the Document Sources (73) element."""
        element = self.wait.until(EC.element_to_be_clickable(self.DOCUMENT_SOURCES_BUTTON))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        element.click()
        return self

    def click_import_vendor_cut_sheets_button(self):
        """Clicks the Import Vendor Cut-Sheets element."""
        element = self.wait.until(EC.element_to_be_clickable(self.IMPORT_VENDOR_CUT_SHEETS_BUTTON))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        element.click()
        return self

    def click_add_custom_equipment_spec_button(self):
        """Clicks the Add Custom Equipment Spec element."""
        element = self.wait.until(EC.element_to_be_clickable(self.ADD_CUSTOM_EQUIPMENT_SPEC_BUTTON))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        element.click()
        return self

    def click_ai_procurement_copilot_button(self):
        """Clicks the AI Procurement Copilot element."""
        element = self.wait.until(EC.element_to_be_clickable(self.AI_PROCUREMENT_COPILOT_BUTTON))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        element.click()
        return self

    def enter_filter_sources_input(self, value: str):
        """Enters text into Filter sources by name or vendor...."""
        element = self.wait.until(EC.visibility_of_element_located(self.FILTER_SOURCES_INPUT))
        element.clear()
        element.send_keys(value)
        return self

    # --- Component Actions: DocumentSourcesList ---
    def click_ask_copilot_button1(self, index: int = 0):
        """Clicks the Ask Copilot element at given row/list index (default 0)."""
        elements = self.wait.until(EC.presence_of_all_elements_located(self.ASK_COPILOT_BUTTON1))
        if index >= len(elements):
            raise IndexError(f"Index {index} out of bounds for ASK_COPILOT_BUTTON1 (total {len(elements)})")
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", elements[index])
        elements[index].click()
        return self

    def click_delete_source_button1(self, index: int = 0):
        """Clicks the Delete Source element at given row/list index (default 0)."""
        elements = self.wait.until(EC.presence_of_all_elements_located(self.DELETE_SOURCE_BUTTON1))
        if index >= len(elements):
            raise IndexError(f"Index {index} out of bounds for DELETE_SOURCE_BUTTON1 (total {len(elements)})")
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", elements[index])
        elements[index].click()
        return self


    # --- Element Verifications ---
    # --- Component Verifications: NavigationMenu ---
    def is_catalog_tab_button_visible(self) -> bool:
        """Returns True if catalogTabButton is visible, False otherwise."""
        try:
            return self.wait.until(EC.visibility_of_element_located(self.CATALOG_TAB_BUTTON)).is_displayed()
        except Exception:
            return False

    def get_catalog_tab_button_text(self) -> str:
        """Returns the text of catalogTabButton."""
        return self.wait.until(EC.visibility_of_element_located(self.CATALOG_TAB_BUTTON)).text

    def is_catalog_tab_button_hidden(self) -> bool:
        """Returns True if catalogTabButton is hidden or absent, False otherwise."""
        try:
            return bool(self.wait.until(EC.invisibility_of_element_located(self.CATALOG_TAB_BUTTON)))
        except Exception:
            return False

    def is_rates_prices_tab_button_visible(self) -> bool:
        """Returns True if ratesPricesTabButton is visible, False otherwise."""
        try:
            return self.wait.until(EC.visibility_of_element_located(self.RATES_PRICES_TAB_BUTTON)).is_displayed()
        except Exception:
            return False

    def get_rates_prices_tab_button_text(self) -> str:
        """Returns the text of ratesPricesTabButton."""
        return self.wait.until(EC.visibility_of_element_located(self.RATES_PRICES_TAB_BUTTON)).text

    def is_rates_prices_tab_button_hidden(self) -> bool:
        """Returns True if ratesPricesTabButton is hidden or absent, False otherwise."""
        try:
            return bool(self.wait.until(EC.invisibility_of_element_located(self.RATES_PRICES_TAB_BUTTON)))
        except Exception:
            return False

    def is_specification_tab_button_visible(self) -> bool:
        """Returns True if specificationTabButton is visible, False otherwise."""
        try:
            return self.wait.until(EC.visibility_of_element_located(self.SPECIFICATION_TAB_BUTTON)).is_displayed()
        except Exception:
            return False

    def get_specification_tab_button_text(self) -> str:
        """Returns the text of specificationTabButton."""
        return self.wait.until(EC.visibility_of_element_located(self.SPECIFICATION_TAB_BUTTON)).text

    def is_specification_tab_button_hidden(self) -> bool:
        """Returns True if specificationTabButton is hidden or absent, False otherwise."""
        try:
            return bool(self.wait.until(EC.invisibility_of_element_located(self.SPECIFICATION_TAB_BUTTON)))
        except Exception:
            return False

    def is_process_sizing_tab_button_visible(self) -> bool:
        """Returns True if processSizingTabButton is visible, False otherwise."""
        try:
            return self.wait.until(EC.visibility_of_element_located(self.PROCESS_SIZING_TAB_BUTTON)).is_displayed()
        except Exception:
            return False

    def get_process_sizing_tab_button_text(self) -> str:
        """Returns the text of processSizingTabButton."""
        return self.wait.until(EC.visibility_of_element_located(self.PROCESS_SIZING_TAB_BUTTON)).text

    def is_process_sizing_tab_button_hidden(self) -> bool:
        """Returns True if processSizingTabButton is hidden or absent, False otherwise."""
        try:
            return bool(self.wait.until(EC.invisibility_of_element_located(self.PROCESS_SIZING_TAB_BUTTON)))
        except Exception:
            return False

    def is_layout_schematics_tab_button_visible(self) -> bool:
        """Returns True if layoutSchematicsTabButton is visible, False otherwise."""
        try:
            return self.wait.until(EC.visibility_of_element_located(self.LAYOUT_SCHEMATICS_TAB_BUTTON)).is_displayed()
        except Exception:
            return False

    def get_layout_schematics_tab_button_text(self) -> str:
        """Returns the text of layoutSchematicsTabButton."""
        return self.wait.until(EC.visibility_of_element_located(self.LAYOUT_SCHEMATICS_TAB_BUTTON)).text

    def is_layout_schematics_tab_button_hidden(self) -> bool:
        """Returns True if layoutSchematicsTabButton is hidden or absent, False otherwise."""
        try:
            return bool(self.wait.until(EC.invisibility_of_element_located(self.LAYOUT_SCHEMATICS_TAB_BUTTON)))
        except Exception:
            return False

    def is_costing_proposal_tab_button_visible(self) -> bool:
        """Returns True if costingProposalTabButton is visible, False otherwise."""
        try:
            return self.wait.until(EC.visibility_of_element_located(self.COSTING_PROPOSAL_TAB_BUTTON)).is_displayed()
        except Exception:
            return False

    def get_costing_proposal_tab_button_text(self) -> str:
        """Returns the text of costingProposalTabButton."""
        return self.wait.until(EC.visibility_of_element_located(self.COSTING_PROPOSAL_TAB_BUTTON)).text

    def is_costing_proposal_tab_button_hidden(self) -> bool:
        """Returns True if costingProposalTabButton is hidden or absent, False otherwise."""
        try:
            return bool(self.wait.until(EC.invisibility_of_element_located(self.COSTING_PROPOSAL_TAB_BUTTON)))
        except Exception:
            return False

    # --- Component Verifications: CatalogToolbar ---
    def is_paint_wittenstein_button_visible(self) -> bool:
        """Returns True if paintWittensteinButton is visible, False otherwise."""
        try:
            return self.wait.until(EC.visibility_of_element_located(self.PAINT_WITTENSTEIN_BUTTON)).is_displayed()
        except Exception:
            return False

    def get_paint_wittenstein_button_text(self) -> str:
        """Returns the text of paintWittensteinButton."""
        return self.wait.until(EC.visibility_of_element_located(self.PAINT_WITTENSTEIN_BUTTON)).text

    def is_paint_wittenstein_button_hidden(self) -> bool:
        """Returns True if paintWittensteinButton is hidden or absent, False otherwise."""
        try:
            return bool(self.wait.until(EC.invisibility_of_element_located(self.PAINT_WITTENSTEIN_BUTTON)))
        except Exception:
            return False

    def is_refresh_catalog_button_visible(self) -> bool:
        """Returns True if refreshCatalogButton is visible, False otherwise."""
        try:
            return self.wait.until(EC.visibility_of_element_located(self.REFRESH_CATALOG_BUTTON)).is_displayed()
        except Exception:
            return False

    def get_refresh_catalog_button_text(self) -> str:
        """Returns the text of refreshCatalogButton."""
        return self.wait.until(EC.visibility_of_element_located(self.REFRESH_CATALOG_BUTTON)).text

    def is_refresh_catalog_button_hidden(self) -> bool:
        """Returns True if refreshCatalogButton is hidden or absent, False otherwise."""
        try:
            return bool(self.wait.until(EC.invisibility_of_element_located(self.REFRESH_CATALOG_BUTTON)))
        except Exception:
            return False

    def is_document_sources_button_visible(self) -> bool:
        """Returns True if documentSourcesButton is visible, False otherwise."""
        try:
            return self.wait.until(EC.visibility_of_element_located(self.DOCUMENT_SOURCES_BUTTON)).is_displayed()
        except Exception:
            return False

    def get_document_sources_button_text(self) -> str:
        """Returns the text of documentSourcesButton."""
        return self.wait.until(EC.visibility_of_element_located(self.DOCUMENT_SOURCES_BUTTON)).text

    def is_document_sources_button_hidden(self) -> bool:
        """Returns True if documentSourcesButton is hidden or absent, False otherwise."""
        try:
            return bool(self.wait.until(EC.invisibility_of_element_located(self.DOCUMENT_SOURCES_BUTTON)))
        except Exception:
            return False

    def is_import_vendor_cut_sheets_button_visible(self) -> bool:
        """Returns True if importVendorCutSheetsButton is visible, False otherwise."""
        try:
            return self.wait.until(EC.visibility_of_element_located(self.IMPORT_VENDOR_CUT_SHEETS_BUTTON)).is_displayed()
        except Exception:
            return False

    def get_import_vendor_cut_sheets_button_text(self) -> str:
        """Returns the text of importVendorCutSheetsButton."""
        return self.wait.until(EC.visibility_of_element_located(self.IMPORT_VENDOR_CUT_SHEETS_BUTTON)).text

    def is_import_vendor_cut_sheets_button_hidden(self) -> bool:
        """Returns True if importVendorCutSheetsButton is hidden or absent, False otherwise."""
        try:
            return bool(self.wait.until(EC.invisibility_of_element_located(self.IMPORT_VENDOR_CUT_SHEETS_BUTTON)))
        except Exception:
            return False

    def is_add_custom_equipment_spec_button_visible(self) -> bool:
        """Returns True if addCustomEquipmentSpecButton is visible, False otherwise."""
        try:
            return self.wait.until(EC.visibility_of_element_located(self.ADD_CUSTOM_EQUIPMENT_SPEC_BUTTON)).is_displayed()
        except Exception:
            return False

    def get_add_custom_equipment_spec_button_text(self) -> str:
        """Returns the text of addCustomEquipmentSpecButton."""
        return self.wait.until(EC.visibility_of_element_located(self.ADD_CUSTOM_EQUIPMENT_SPEC_BUTTON)).text

    def is_add_custom_equipment_spec_button_hidden(self) -> bool:
        """Returns True if addCustomEquipmentSpecButton is hidden or absent, False otherwise."""
        try:
            return bool(self.wait.until(EC.invisibility_of_element_located(self.ADD_CUSTOM_EQUIPMENT_SPEC_BUTTON)))
        except Exception:
            return False

    def is_ai_procurement_copilot_button_visible(self) -> bool:
        """Returns True if aiProcurementCopilotButton is visible, False otherwise."""
        try:
            return self.wait.until(EC.visibility_of_element_located(self.AI_PROCUREMENT_COPILOT_BUTTON)).is_displayed()
        except Exception:
            return False

    def get_ai_procurement_copilot_button_text(self) -> str:
        """Returns the text of aiProcurementCopilotButton."""
        return self.wait.until(EC.visibility_of_element_located(self.AI_PROCUREMENT_COPILOT_BUTTON)).text

    def is_ai_procurement_copilot_button_hidden(self) -> bool:
        """Returns True if aiProcurementCopilotButton is hidden or absent, False otherwise."""
        try:
            return bool(self.wait.until(EC.invisibility_of_element_located(self.AI_PROCUREMENT_COPILOT_BUTTON)))
        except Exception:
            return False

    def is_filter_sources_input_visible(self) -> bool:
        """Returns True if filterSourcesInput is visible, False otherwise."""
        try:
            return self.wait.until(EC.visibility_of_element_located(self.FILTER_SOURCES_INPUT)).is_displayed()
        except Exception:
            return False

    def get_filter_sources_input_text(self) -> str:
        """Returns the text of filterSourcesInput."""
        return self.wait.until(EC.visibility_of_element_located(self.FILTER_SOURCES_INPUT)).text

    def is_filter_sources_input_hidden(self) -> bool:
        """Returns True if filterSourcesInput is hidden or absent, False otherwise."""
        try:
            return bool(self.wait.until(EC.invisibility_of_element_located(self.FILTER_SOURCES_INPUT)))
        except Exception:
            return False

    # --- Component Verifications: DocumentSourcesList ---
    def is_ask_copilot_button1_visible(self, index: int = 0) -> bool:
        """Returns True if askCopilotButton1 at index is visible, False otherwise."""
        try:
            elements = self.wait.until(EC.presence_of_all_elements_located(self.ASK_COPILOT_BUTTON1))
            return elements[index].is_displayed() if index < len(elements) else False
        except Exception:
            return False

    def get_ask_copilot_button1_text(self, index: int = 0) -> str:
        """Returns the text of askCopilotButton1 at index."""
        elements = self.wait.until(EC.presence_of_all_elements_located(self.ASK_COPILOT_BUTTON1))
        return elements[index].text if index < len(elements) else ""

    def is_ask_copilot_button1_hidden(self) -> bool:
        """Returns True if askCopilotButton1 is hidden or absent, False otherwise."""
        try:
            return bool(self.wait.until(EC.invisibility_of_element_located(self.ASK_COPILOT_BUTTON1)))
        except Exception:
            return False

    def is_delete_source_button1_visible(self, index: int = 0) -> bool:
        """Returns True if deleteSourceButton1 at index is visible, False otherwise."""
        try:
            elements = self.wait.until(EC.presence_of_all_elements_located(self.DELETE_SOURCE_BUTTON1))
            return elements[index].is_displayed() if index < len(elements) else False
        except Exception:
            return False

    def get_delete_source_button1_text(self, index: int = 0) -> str:
        """Returns the text of deleteSourceButton1 at index."""
        elements = self.wait.until(EC.presence_of_all_elements_located(self.DELETE_SOURCE_BUTTON1))
        return elements[index].text if index < len(elements) else ""

    def is_delete_source_button1_hidden(self) -> bool:
        """Returns True if deleteSourceButton1 is hidden or absent, False otherwise."""
        try:
            return bool(self.wait.until(EC.invisibility_of_element_located(self.DELETE_SOURCE_BUTTON1)))
        except Exception:
            return False

