import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext, API } from '../App';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, LogOut, Settings, FileText, Calendar } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    order_number: '',
    google_sheet_link: ''
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders`);
      setOrders(response.data);
    } catch (error) {
      if (error.response?.status === 403) {
        // User not approved - silent failure, will show message in UI
        setOrders([]);
      } else {
        toast.error('Failed to fetch orders');
      }
    } finally {
      setLoading(false);
    }
  };

  const createOrder = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/orders`, formData);
      toast.success('Order created successfully!');
      setDialogOpen(false);
      setFormData({ order_number: '', google_sheet_link: '' });
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create order');
    }
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-700 border-red-200',
      order_uploader: 'bg-blue-100 text-blue-700 border-blue-200',
      pattern_maker: 'bg-green-100 text-green-700 border-green-200',
      pattern_checker: 'bg-purple-100 text-purple-700 border-purple-200',
      general_user: 'bg-slate-100 text-slate-700 border-slate-200'
    };
    return colors[role] || colors.general_user;
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Admin',
      order_uploader: 'Order Uploader',
      pattern_maker: 'Pattern Maker',
      pattern_checker: 'Pattern Checker',
      general_user: 'General User'
    };
    return labels[role] || role;
  };

  const canCreateOrder = user?.role === 'admin' || user?.role === 'order_uploader';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header */}
      <header className="glass border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
                Pattern <span className="gradient-text">Manager</span>
              </h1>
              <p className="text-sm text-slate-600 mt-0.5">Welcome, {user?.name}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge className={`${getRoleBadgeColor(user?.role)} border font-medium`}>
                {getRoleLabel(user?.role)}
              </Badge>
              
              {user?.role === 'admin' && (
                <Button
                  data-testid="admin-panel-button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="border-slate-300"
                >
                  <Settings className="w-4 h-4 mr-1.5" />
                  Admin Panel
                </Button>
              )}
              
              <Button
                data-testid="logout-button"
                variant="outline"
                size="sm"
                onClick={logout}
                className="border-slate-300"
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Action Bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>Orders</h2>
            <p className="text-slate-600 mt-1">Manage and track pattern orders</p>
          </div>
          
          {canCreateOrder && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  data-testid="create-order-button"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create Order
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Order</DialogTitle>
                </DialogHeader>
                <form onSubmit={createOrder} className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="order_number">Order Number</Label>
                    <Input
                      id="order_number"
                      data-testid="order-number-input"
                      value={formData.order_number}
                      onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                      placeholder="ORD-001"
                      required
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="google_sheet_link">Google Sheet Link</Label>
                    <Input
                      id="google_sheet_link"
                      data-testid="google-sheet-link-input"
                      value={formData.google_sheet_link}
                      onChange={(e) => setFormData({ ...formData, google_sheet_link: e.target.value })}
                      placeholder="https://docs.google.com/spreadsheets/..."
                      required
                      className="mt-1.5"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    data-testid="submit-create-order"
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    Create Order
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Orders Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="animate-shimmer" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <Card className="text-center py-16">
            {!user?.is_approved && user?.role !== 'admin' ? (
              <>
                <Shield className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Account Pending Approval</h3>
                <p className="text-slate-500 mb-2">Your account is awaiting admin approval.</p>
                <p className="text-slate-500">You'll be able to access orders once your account is approved.</p>
              </>
            ) : (
              <>
                <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">No orders yet</h3>
                <p className="text-slate-500 mb-6">Get started by creating your first order</p>
                {canCreateOrder && (
                  <Button 
                    onClick={() => setDialogOpen(true)}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Create First Order
                  </Button>
                )}
              </>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => (
              <Card 
                key={order.id} 
                data-testid={`order-card-${order.id}`}
                className="card-hover cursor-pointer border-slate-200 hover:border-blue-300 transition-colors"
                onClick={() => navigate(`/order/${order.id}`)}
              >
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">{order.order_number}</CardTitle>
                  <div className="flex items-center text-xs text-slate-500 mt-2">
                    <Calendar className="w-3.5 h-3.5 mr-1.5" />
                    {new Date(order.created_at).toLocaleDateString()}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Initial Pattern:</span>
                      <Badge 
                        variant={order.initial_pattern_status === 'approved' ? 'default' : order.initial_pattern_status === 'rejected' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {order.initial_pattern_status || (order.initial_pattern_date ? 'Uploaded' : 'Pending')}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Second Review:</span>
                      <Badge 
                        variant={order.second_pattern_status === 'approved' ? 'default' : order.second_pattern_status === 'rejected' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {order.second_pattern_status || 'Pending'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Final Status:</span>
                      <Badge 
                        variant={order.approved_pattern_status === 'approved' ? 'default' : order.approved_pattern_status === 'rejected' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {order.approved_pattern_status || 'Pending'}
                      </Badge>
                    </div>
                  </div>
                  
                  <Button 
                    data-testid={`view-order-${order.id}`}
                    variant="outline" 
                    className="w-full mt-4 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/order/${order.id}`);
                    }}
                  >
                    View Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
