import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Users, Shield, Trash2, Power, PowerOff } from 'lucide-react';

const AdminPanel = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (userId, newRole) => {
    try {
      await axios.patch(`${API}/users/${userId}/role`, { role: newRole });
      toast.success('Role updated successfully!');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update role');
    }
  };

  const approveUser = async (userId) => {
    try {
      await axios.patch(`${API}/users/${userId}/approve`);
      toast.success('User approved successfully!');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve user');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header */}
      <header className="glass border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button
              data-testid="back-to-dashboard"
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
                Admin <span className="gradient-text">Panel</span>
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-blue-600" />
              <div>
                <CardTitle className="text-2xl">User Management</CardTitle>
                <CardDescription>Assign roles and manage user permissions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-slate-600">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No users found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((u) => (
                  <Card key={u.id} className="border-slate-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900">{u.name}</div>
                          <div className="text-sm text-slate-500">{u.email}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            Joined {new Date(u.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {!u.is_approved && (
                            <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 border font-medium">
                              Pending Approval
                            </Badge>
                          )}
                          
                          <Badge className={`${getRoleBadgeColor(u.role)} border font-medium`}>
                            {getRoleLabel(u.role)}
                          </Badge>
                          
                          {!u.is_approved && (
                            <Button
                              data-testid={`approve-user-${u.id}`}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => approveUser(u.id)}
                            >
                              Approve
                            </Button>
                          )}
                          
                          <Select
                            value={u.role}
                            onValueChange={(newRole) => updateRole(u.id, newRole)}
                          >
                            <SelectTrigger data-testid={`role-select-${u.id}`} className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="order_uploader">Order Uploader</SelectItem>
                              <SelectItem value="pattern_maker">Pattern Maker</SelectItem>
                              <SelectItem value="pattern_checker">Pattern Checker</SelectItem>
                              <SelectItem value="general_user">General User</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role Descriptions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Role Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="font-semibold text-sm">Admin</div>
                <p className="text-sm text-slate-600">Full access to all features including user management</p>
              </div>
              <div className="space-y-2">
                <div className="font-semibold text-sm">Order Uploader</div>
                <p className="text-sm text-slate-600">Can create and edit order information</p>
              </div>
              <div className="space-y-2">
                <div className="font-semibold text-sm">Pattern Maker</div>
                <p className="text-sm text-slate-600">Can upload initial patterns and participate in chat</p>
              </div>
              <div className="space-y-2">
                <div className="font-semibold text-sm">Pattern Checker</div>
                <p className="text-sm text-slate-600">Can review, approve/reject patterns, and upload corrections</p>
              </div>
              <div className="space-y-2">
                <div className="font-semibold text-sm">General User</div>
                <p className="text-sm text-slate-600">View-only access to orders and chat</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminPanel;
