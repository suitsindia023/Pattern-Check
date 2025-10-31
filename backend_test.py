import requests
import sys
import json
import io
from datetime import datetime

class PatternMakerAPITester:
    def __init__(self, base_url="https://bitoken-trader.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tokens = {}  # Store tokens for different users
        self.users = {}   # Store user data
        self.orders = {}  # Store created orders
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, token=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        if files:
            # Remove Content-Type for file uploads
            del headers['Content-Type']

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)

            success = response.status_code == expected_status
            
            if success:
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                error_detail = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_data = response.json()
                    if 'detail' in error_data:
                        error_detail += f" - {error_data['detail']}"
                except:
                    pass
                return False, error_detail

        except Exception as e:
            return False, f"Request failed: {str(e)}"

    def test_user_registration_and_login(self):
        """Test user registration and login for different roles"""
        print("\n🔍 Testing User Registration and Authentication...")
        
        # Test user registration with unique timestamps
        timestamp = datetime.now().strftime("%H%M%S")
        test_users = [
            {"email": f"admin{timestamp}@test.com", "password": "TestPass123!", "name": "Admin User", "role": "admin"},
            {"email": f"uploader{timestamp}@test.com", "password": "TestPass123!", "name": "Order Uploader", "role": "order_uploader"},
            {"email": f"maker{timestamp}@test.com", "password": "TestPass123!", "name": "Pattern Maker", "role": "pattern_maker"},
            {"email": f"checker{timestamp}@test.com", "password": "TestPass123!", "name": "Pattern Checker", "role": "pattern_checker"},
            {"email": f"user{timestamp}@test.com", "password": "TestPass123!", "name": "General User", "role": "general_user"}
        ]

        for user_data in test_users:
            # Register user
            success, response = self.run_test(
                f"Register {user_data['role']}",
                "POST",
                "auth/register",
                200,
                data={
                    "email": user_data["email"],
                    "password": user_data["password"],
                    "name": user_data["name"]
                }
            )
            
            self.log_test(f"Register {user_data['role']}", success, response if not success else "")
            
            if success:
                self.tokens[user_data['role']] = response.get('access_token')
                self.users[user_data['role']] = response.get('user')

        # Test login for admin user
        success, response = self.run_test(
            "Login admin user",
            "POST",
            "auth/login",
            200,
            data={"email": f"admin{timestamp}@test.com", "password": "TestPass123!"}
        )
        self.log_test("Login admin user", success, response if not success else "")
        
        if success:
            # Update token with login response
            self.tokens['admin'] = response.get('access_token')
            self.users['admin'] = response.get('user')

        # Test /auth/me endpoint
        if self.tokens.get('admin'):
            success, response = self.run_test(
                "Get current user info",
                "GET",
                "auth/me",
                200,
                token=self.tokens['admin']
            )
            self.log_test("Get current user info", success, response if not success else "")

    def test_admin_user_management(self):
        """Test admin user management functionality"""
        print("\n🔍 Testing Admin User Management...")
        
        # First, manually assign admin role to the first registered user
        # Since all users start as general_user, we need to manually promote one to admin
        print("Note: All users register as 'general_user' by default. Need manual admin assignment.")
        
        # Check current user role
        if self.tokens.get('admin'):
            success, response = self.run_test(
                "Check admin user role",
                "GET",
                "auth/me",
                200,
                token=self.tokens['admin']
            )
            if success:
                current_role = response.get('role', 'unknown')
                print(f"Current user role: {current_role}")
                self.log_test(f"Check admin user role (currently: {current_role})", success, "")
                
                # If user is not admin, we can't test admin functions
                if current_role != 'admin':
                    self.log_test("Admin user management", False, f"User role is '{current_role}', not 'admin'. Manual role assignment needed.")
                    return
            else:
                self.log_test("Check admin user role", success, response)
                return

        # Test getting all users (admin only)
        success, response = self.run_test(
            "Get all users (admin)",
            "GET",
            "users",
            200,
            token=self.tokens['admin']
        )
        self.log_test("Get all users (admin)", success, response if not success else "")

        # Test role assignment
        if success and self.users.get('general_user'):
            user_id = self.users['general_user']['id']
            success, response = self.run_test(
                "Update user role",
                "PATCH",
                f"users/{user_id}/role",
                200,
                data={"role": "order_uploader"},
                token=self.tokens['admin']
            )
            self.log_test("Update user role", success, response if not success else "")

        # Test non-admin access to user management (should fail)
        if self.tokens.get('general_user'):
            success, response = self.run_test(
                "Get users (non-admin) - should fail",
                "GET",
                "users",
                403,
                token=self.tokens['general_user']
            )
            self.log_test("Get users (non-admin) - should fail", success, response if not success else "")

    def test_order_management(self):
        """Test order creation and management"""
        print("\n🔍 Testing Order Management...")

        # Check admin user role first
        if self.tokens.get('admin'):
            success, response = self.run_test(
                "Check admin role for order creation",
                "GET",
                "auth/me",
                200,
                token=self.tokens['admin']
            )
            if success:
                admin_role = response.get('role', 'unknown')
                print(f"Admin user role: {admin_role}")
                if admin_role not in ['admin', 'order_uploader']:
                    print(f"⚠️  User role '{admin_role}' cannot create orders. Skipping order creation tests.")
                    self.log_test("Order creation test", False, f"User role '{admin_role}' lacks permission")
                    return

        # Test order creation by admin
        if self.tokens.get('admin'):
            success, response = self.run_test(
                "Create order (admin)",
                "POST",
                "orders",
                200,
                data={
                    "order_number": "ORD-001",
                    "google_sheet_link": "https://docs.google.com/spreadsheets/test"
                },
                token=self.tokens['admin']
            )
            self.log_test("Create order (admin)", success, response if not success else "")
            
            if success:
                self.orders['test_order'] = response

        # Test order creation by order_uploader
        if self.tokens.get('order_uploader'):
            success, response = self.run_test(
                "Create order (order_uploader)",
                "POST",
                "orders",
                200,
                data={
                    "order_number": "ORD-002",
                    "google_sheet_link": "https://docs.google.com/spreadsheets/test2"
                },
                token=self.tokens['order_uploader']
            )
            self.log_test("Create order (order_uploader)", success, response if not success else "")

        # Test order creation by unauthorized user (should fail)
        if self.tokens.get('general_user'):
            success, response = self.run_test(
                "Create order (general_user) - should fail",
                "POST",
                "orders",
                403,
                data={
                    "order_number": "ORD-003",
                    "google_sheet_link": "https://docs.google.com/spreadsheets/test3"
                },
                token=self.tokens['general_user']
            )
            self.log_test("Create order (general_user) - should fail", success, response if not success else "")

        # Test getting all orders
        if self.tokens.get('admin'):
            success, response = self.run_test(
                "Get all orders",
                "GET",
                "orders",
                200,
                token=self.tokens['admin']
            )
            self.log_test("Get all orders", success, response if not success else "")

        # Test getting specific order
        if self.orders.get('test_order'):
            order_id = self.orders['test_order']['id']
            success, response = self.run_test(
                "Get specific order",
                "GET",
                f"orders/{order_id}",
                200,
                token=self.tokens['admin']
            )
            self.log_test("Get specific order", success, response if not success else "")

    def test_pattern_upload_permissions(self):
        """Test pattern upload with role-based permissions"""
        print("\n🔍 Testing Pattern Upload Permissions...")

        if not self.orders.get('test_order'):
            self.log_test("Pattern upload test", False, "No test order available")
            return

        order_id = self.orders['test_order']['id']

        # Create a dummy file for testing
        test_file_content = b"dummy pattern file content"
        
        # Test initial pattern upload by pattern_maker
        if self.tokens.get('pattern_maker'):
            files = {'file': ('test_pattern.dxf', io.BytesIO(test_file_content), 'application/octet-stream')}
            data = {'stage': 'initial', 'slot': '1'}
            
            success, response = self.run_test(
                "Upload initial pattern (pattern_maker)",
                "POST",
                f"orders/{order_id}/patterns",
                200,
                data=data,
                files=files,
                token=self.tokens['pattern_maker']
            )
            self.log_test("Upload initial pattern (pattern_maker)", success, response if not success else "")

        # Test initial pattern upload by unauthorized user (should fail)
        if self.tokens.get('general_user'):
            files = {'file': ('test_pattern.dxf', io.BytesIO(test_file_content), 'application/octet-stream')}
            data = {'stage': 'initial', 'slot': '2'}
            
            success, response = self.run_test(
                "Upload initial pattern (general_user) - should fail",
                "POST",
                f"orders/{order_id}/patterns",
                403,
                data=data,
                files=files,
                token=self.tokens['general_user']
            )
            self.log_test("Upload initial pattern (general_user) - should fail", success, response if not success else "")

        # Test getting patterns for order
        if self.tokens.get('admin'):
            success, response = self.run_test(
                "Get order patterns",
                "GET",
                f"orders/{order_id}/patterns",
                200,
                token=self.tokens['admin']
            )
            self.log_test("Get order patterns", success, response if not success else "")

    def test_approval_workflow(self):
        """Test pattern approval workflow"""
        print("\n🔍 Testing Approval Workflow...")

        if not self.orders.get('test_order'):
            self.log_test("Approval workflow test", False, "No test order available")
            return

        order_id = self.orders['test_order']['id']

        # Test approval by pattern_checker
        if self.tokens.get('pattern_checker'):
            success, response = self.run_test(
                "Approve second pattern (pattern_checker)",
                "POST",
                f"orders/{order_id}/approve",
                200,
                data={"stage": "second", "status": "approved"},
                token=self.tokens['pattern_checker']
            )
            self.log_test("Approve second pattern (pattern_checker)", success, response if not success else "")

        # Test approval by unauthorized user (should fail)
        if self.tokens.get('general_user'):
            success, response = self.run_test(
                "Approve pattern (general_user) - should fail",
                "POST",
                f"orders/{order_id}/approve",
                403,
                data={"stage": "approved", "status": "approved"},
                token=self.tokens['general_user']
            )
            self.log_test("Approve pattern (general_user) - should fail", success, response if not success else "")

    def test_chat_functionality(self):
        """Test chat functionality"""
        print("\n🔍 Testing Chat Functionality...")

        if not self.orders.get('test_order'):
            self.log_test("Chat functionality test", False, "No test order available")
            return

        order_id = self.orders['test_order']['id']

        # Test sending text message
        if self.tokens.get('admin'):
            data = {'message': 'Test chat message from admin'}
            success, response = self.run_test(
                "Send chat message",
                "POST",
                f"orders/{order_id}/chat",
                200,
                data=data,
                token=self.tokens['admin']
            )
            self.log_test("Send chat message", success, response if not success else "")

        # Test getting chat messages
        if self.tokens.get('admin'):
            success, response = self.run_test(
                "Get chat messages",
                "GET",
                f"orders/{order_id}/chat",
                200,
                token=self.tokens['admin']
            )
            self.log_test("Get chat messages", success, response if not success else "")

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Pattern Maker Backend API Tests")
        print(f"Testing against: {self.base_url}")
        
        try:
            self.test_user_registration_and_login()
            self.test_admin_user_management()
            self.test_order_management()
            self.test_pattern_upload_permissions()
            self.test_approval_workflow()
            self.test_chat_functionality()
        except Exception as e:
            print(f"❌ Test suite failed with error: {str(e)}")
            return False

        # Print summary
        print(f"\n📊 Backend Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend tests passed!")
            return True
        else:
            print("⚠️  Some backend tests failed")
            return False

def main():
    tester = PatternMakerAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    results = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": tester.tests_run,
        "passed_tests": tester.tests_passed,
        "success_rate": (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0,
        "test_details": tester.test_results
    }
    
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())