import requests
import sys
import json
from datetime import datetime

class BasicPatternMakerAPITester:
    def __init__(self, base_url="https://bitoken-trader.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user = None
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

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
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

    def test_basic_functionality(self):
        """Test basic API functionality that doesn't require special roles"""
        print("\n🔍 Testing Basic API Functionality...")
        
        timestamp = datetime.now().strftime("%H%M%S%f")
        test_email = f"testuser{timestamp}@test.com"
        test_password = "TestPass123!"
        test_name = "Test User"

        # Test user registration
        success, response = self.run_test(
            "User registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": test_email,
                "password": test_password,
                "name": test_name
            }
        )
        self.log_test("User registration", success, response if not success else "")
        
        if success:
            self.token = response.get('access_token')
            self.user = response.get('user')
            print(f"Registered user: {self.user.get('name')} with role: {self.user.get('role')}")

        # Test user login
        success, response = self.run_test(
            "User login",
            "POST",
            "auth/login",
            200,
            data={
                "email": test_email,
                "password": test_password
            }
        )
        self.log_test("User login", success, response if not success else "")

        # Test /auth/me endpoint
        if self.token:
            success, response = self.run_test(
                "Get current user info",
                "GET",
                "auth/me",
                200,
                token=self.token
            )
            self.log_test("Get current user info", success, response if not success else "")

        # Test invalid login
        success, response = self.run_test(
            "Invalid login (should fail)",
            "POST",
            "auth/login",
            401,
            data={
                "email": test_email,
                "password": "wrongpassword"
            }
        )
        self.log_test("Invalid login (should fail)", success, response if not success else "")

    def test_protected_endpoints(self):
        """Test protected endpoints that require authentication"""
        print("\n🔍 Testing Protected Endpoints...")

        if not self.token:
            self.log_test("Protected endpoints test", False, "No authentication token available")
            return

        # Test getting orders (should work for any authenticated user)
        success, response = self.run_test(
            "Get orders (authenticated)",
            "GET",
            "orders",
            200,
            token=self.token
        )
        self.log_test("Get orders (authenticated)", success, response if not success else "")

        # Test accessing admin endpoints (should fail for general user)
        success, response = self.run_test(
            "Get users (general user - should fail)",
            "GET",
            "users",
            403,
            token=self.token
        )
        self.log_test("Get users (general user - should fail)", success, response if not success else "")

        # Test creating order (should fail for general user)
        success, response = self.run_test(
            "Create order (general user - should fail)",
            "POST",
            "orders",
            403,
            data={
                "order_number": "TEST-001",
                "google_sheet_link": "https://docs.google.com/spreadsheets/test"
            },
            token=self.token
        )
        self.log_test("Create order (general user - should fail)", success, response if not success else "")

    def test_unauthenticated_access(self):
        """Test endpoints without authentication (should fail)"""
        print("\n🔍 Testing Unauthenticated Access...")

        # Test accessing protected endpoint without token
        success, response = self.run_test(
            "Get orders (no auth - should fail)",
            "GET",
            "orders",
            401
        )
        self.log_test("Get orders (no auth - should fail)", success, response if not success else "")

        # Test accessing user info without token
        success, response = self.run_test(
            "Get user info (no auth - should fail)",
            "GET",
            "auth/me",
            401
        )
        self.log_test("Get user info (no auth - should fail)", success, response if not success else "")

    def run_all_tests(self):
        """Run all basic backend tests"""
        print("🚀 Starting Basic Pattern Maker Backend API Tests")
        print(f"Testing against: {self.base_url}")
        print("Note: Testing basic functionality only - admin role assignment needed for full testing")
        
        try:
            self.test_basic_functionality()
            self.test_protected_endpoints()
            self.test_unauthenticated_access()
        except Exception as e:
            print(f"❌ Test suite failed with error: {str(e)}")
            return False

        # Print summary
        print(f"\n📊 Basic Backend Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        if success_rate >= 80:
            print("🎉 Basic backend functionality is working!")
            return True
        else:
            print("⚠️  Some basic backend tests failed")
            return False

def main():
    tester = BasicPatternMakerAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    results = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": tester.tests_run,
        "passed_tests": tester.tests_passed,
        "success_rate": (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0,
        "test_details": tester.test_results,
        "limitations": [
            "Admin role assignment requires manual database intervention",
            "Full workflow testing requires pre-existing admin user",
            "File upload testing requires order creation permissions"
        ]
    }
    
    with open('/app/backend_test_basic_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())