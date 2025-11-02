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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Calendar, ArrowLeft } from 'lucide-react';

const Orders = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [allOrders, setAllOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // all, approved, rejected, no_action
  const [dateFilter, setDateFilter] = useState(30); // days
  const [formData, setFormData] = useState({
    order_number: '',
    google_sheet_link: ''
  });

  const statusFilters = [
    { label: 'All Orders', value: 'all' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'No Action', value: 'no_action' }
  ];

  const dateFilters = [
    { label: 'Today', days: 1 },
    { label: 'Last 3 Days', days: 3 },
    { label: 'Last Week', days: 7 },
    { label: 'Last Month', days: 30 },
    { label: 'Last 3 Months', days: 90 }
  ];

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allOrders, statusFilter, dateFilter]);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders`);
      setAllOrders(response.data);
    } catch (error) {
      if (error.response?.status === 403) {
        setAllOrders([]);
      } else {
        toast.error('Failed to fetch orders');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allOrders];

    // Date filter
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - dateFilter);
    filtered = filtered.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate >= cutoffDate;
    });

    // Status filter
    if (statusFilter === 'approved') {
      filtered = filtered.filter(order => order.approved_pattern_status === 'approved');
    } else if (statusFilter === 'rejected') {
      filtered = filtered.filter(order => 
        order.initial_pattern_status === 'rejected' || 
        order.second_pattern_status === 'rejected' ||
        order.approved_pattern_status === 'rejected'
      );
    } else if (statusFilter === 'no_action') {
      filtered = filtered.filter(order => 
        !order.initial_pattern_status && 
        !order.second_pattern_status && 
        !order.approved_pattern_status
      );
    }

    setFilteredOrders(filtered);
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

  const canCreateOrder = user?.role === 'admin' || user?.role === 'order_uploader';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header */}
      <header className="glass border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                data-testid="back-to-dashboard"
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Dashboard
              </Button>
              <div>
                <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
                  All Orders
                </h1>
              </div>
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
                      <Label htmlFor="google_sheet_link">Order Sheet Link</Label>
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
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Status Tabs */}
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="bg-white">
              {statusFilters.map((filter) => (
                <TabsTrigger 
                  key={filter.value} 
                  value={filter.value}
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  {filter.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Date Filters */}
          <Tabs value={dateFilter.toString()} onValueChange={(val) => setDateFilter(parseInt(val))}>
            <TabsList className="bg-white">
              {dateFilters.map((filter) => (
                <TabsTrigger 
                  key={filter.days} 
                  value={filter.days.toString()}
                  className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                >
                  {filter.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="text-sm text-slate-600">
            Showing {filteredOrders.length} of {allOrders.length} orders
          </div>
        </div>

        {/* Orders Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="animate-shimmer" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card className="text-center py-16">
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No orders found</h3>
            <p className="text-slate-500 mb-6">Try adjusting your filters or create a new order</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrders.map((order) => (
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

export default Orders;
