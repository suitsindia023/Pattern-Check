import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext, API } from '../App';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { ArrowLeft, Upload, Download, MessageSquare, Check, X, ExternalLink, Image as ImageIcon, Send, FileText, Reply } from 'lucide-react';

const OrderDetail = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [order, setOrder] = useState(null);
  const [patterns, setPatterns] = useState({ initial: [], second: [], approved: [] });
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadStage, setUploadStage] = useState('');
  const [uploadSlot, setUploadSlot] = useState(1);
  const [chatMessage, setChatMessage] = useState('');
  const [chatImage, setChatImage] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [quotedMessage, setQuotedMessage] = useState(null);
  const [chatImagePreview, setChatImagePreview] = useState(null);

  useEffect(() => {
    fetchOrderData();
    const interval = setInterval(fetchChats, 3000);
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchOrderData = async () => {
    try {
      const [orderRes, patternsRes, chatsRes] = await Promise.all([
        axios.get(`${API}/orders/${orderId}`),
        axios.get(`${API}/orders/${orderId}/patterns`),
        axios.get(`${API}/orders/${orderId}/chat`)
      ]);
      
      setOrder(orderRes.data);
      setChats(chatsRes.data);
      
      const patternsByStage = {
        initial: patternsRes.data.filter(p => p.stage === 'initial'),
        second: patternsRes.data.filter(p => p.stage === 'second'),
        approved: patternsRes.data.filter(p => p.stage === 'approved')
      };
      setPatterns(patternsByStage);
    } catch (error) {
      toast.error('Failed to fetch order data');
    } finally {
      setLoading(false);
    }
  };

  const fetchChats = async () => {
    try {
      const response = await axios.get(`${API}/orders/${orderId}/chat`);
      setChats(response.data);
    } catch (error) {
      // Silently fail for polling
    }
  };

  const handleFileUpload = async (e, stage, slot) => {
    e.preventDefault();
    const fileInput = document.getElementById(`file-${stage}-${slot}`);
    const file = fileInput?.files[0];
    
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('stage', stage);
    formData.append('slot', slot);

    try {
      await axios.post(`${API}/orders/${orderId}/patterns`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Pattern uploaded successfully!');
      setSelectedFiles(prev => {
        const updated = { ...prev };
        delete updated[`${stage}-${slot}`];
        return updated;
      });
      fetchOrderData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    }
  };

  const handleFileSelect = (e, stage, slot) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFiles(prev => ({
        ...prev,
        [`${stage}-${slot}`]: file.name
      }));
    }
  };

  const handleDeletePattern = async (patternId, stage, slot) => {
    if (!window.confirm('Are you sure you want to delete this pattern? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`${API}/patterns/${patternId}`);
      toast.success('Pattern deleted successfully!');
      fetchOrderData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Delete failed');
    }
  };

  const handleDownload = async (patternId, filename) => {
    try {
      const response = await axios.get(`${API}/patterns/${patternId}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Download started');
    } catch (error) {
      toast.error('Download failed');
    }
  };

  const handleApproval = async (stage, status) => {
    const stageNames = {
      initial: 'Initial Pattern',
      second: 'Second Pattern Review',
      approved: 'Final Approved Pattern'
    };
    
    const confirmMessage = `Are you sure you want to ${status} ${stageNames[stage]}?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      await axios.post(`${API}/orders/${orderId}/approve`, { stage, status });
      toast.success(`Order ${status} successfully!`);
      fetchOrderData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Action failed');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim() && !chatImage) return;

    const formData = new FormData();
    formData.append('message', chatMessage);
    if (chatImage) {
      formData.append('image', chatImage);
    }
    if (quotedMessage) {
      formData.append('quoted_message_id', quotedMessage.id);
    }

    try {
      await axios.post(`${API}/orders/${orderId}/chat`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setChatMessage('');
      setChatImage(null);
      setChatImagePreview(null);
      setQuotedMessage(null);
      
      // Reset file input
      const fileInput = document.getElementById('chat-image-input');
      if (fileInput) fileInput.value = '';
      
      fetchChats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send message');
    }
  };

  const handleChatImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setChatImage(file);
      setChatImagePreview(file.name);
    }
  };

  const handleDeleteOrder = async () => {
    if (!window.confirm('Are you sure you want to delete this entire order? This will delete all patterns and chats. This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`${API}/orders/${orderId}`);
      toast.success('Order deleted successfully!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete order');
    }
  };

  const canUploadInitial = user?.role === 'admin' || user?.role === 'pattern_maker';
  const canUploadSecondApproved = user?.role === 'admin' || user?.role === 'pattern_checker';
  const canApprove = user?.role === 'admin' || user?.role === 'pattern_checker';
  const canUploadChatImage = user?.role === 'admin' || user?.role === 'pattern_maker' || user?.role === 'pattern_checker';
  const isAdmin = user?.role === 'admin';

  const renderPatternSlots = (stage, stagePatterns, canUpload) => {
    const isInitialRejected = order?.initial_pattern_status === 'rejected';
    const shouldEnableSecondButtons = stage === 'second' && isInitialRejected;
    
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map(slot => {
          const pattern = stagePatterns.find(p => p.slot === slot);
          const selectedFileName = selectedFiles[`${stage}-${slot}`];
          
          return (
            <Card key={slot} className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Pattern {slot}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pattern ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-1.5 rounded">
                      <FileText className="w-3.5 h-3.5" />
                      <span className="truncate">{pattern.filename}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(pattern.uploaded_at).toLocaleDateString()}
                    </div>
                    <Button
                      data-testid={`download-${stage}-${slot}`}
                      size="sm"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleDownload(pattern.id, pattern.filename)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Download
                    </Button>
                    {isAdmin && (
                      <Button
                        data-testid={`delete-${stage}-${slot}`}
                        size="sm"
                        className="w-full bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => handleDeletePattern(pattern.id, stage, slot)}
                      >
                        <X className="w-3.5 h-3.5 mr-1.5" />
                        Delete
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {canUpload ? (
                      <>
                        <Label htmlFor={`file-${stage}-${slot}`} className="text-xs text-slate-600">
                          File
                        </Label>
                        <Input
                          id={`file-${stage}-${slot}`}
                          data-testid={`upload-input-${stage}-${slot}`}
                          type="file"
                          className="text-xs"
                          onChange={(e) => handleFileSelect(e, stage, slot)}
                        />
                        {selectedFileName && (
                          <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded truncate">
                            {selectedFileName}
                          </div>
                        )}
                        <Button
                          data-testid={`upload-${stage}-${slot}`}
                          size="sm"
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={(e) => handleFileUpload(e, stage, slot)}
                        >
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                          Upload
                        </Button>
                      </>
                    ) : (
                      <div className="text-xs text-center text-slate-400 py-4">No file uploaded</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl font-medium text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header */}
      <header className="glass border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button
              data-testid="back-button"
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
                {order?.order_number}
              </h1>
              <a 
                href={order?.google_sheet_link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-0.5"
              >
                View Google Sheet <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            {isAdmin && (
              <Button
                data-testid="delete-order-button"
                variant="outline"
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={handleDeleteOrder}
              >
                <X className="w-4 h-4 mr-1.5" />
                Delete Order
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side - Patterns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Initial Patterns */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Initial Patterns</CardTitle>
                    <CardDescription>Pattern Maker uploads initial patterns</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {order?.initial_pattern_date && (
                      <Badge variant="secondary" className="text-xs">
                        {new Date(order.initial_pattern_date).toLocaleDateString()}
                      </Badge>
                    )}
                    {order?.initial_pattern_status && (
                      <Badge 
                        variant={order.initial_pattern_status === 'approved' ? 'default' : 'destructive'}
                        className="text-xs capitalize"
                      >
                        {order.initial_pattern_status}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderPatternSlots('initial', patterns.initial, canUploadInitial)}
                
                {canApprove && !order?.initial_pattern_status && (
                  <div className="flex gap-2 pt-4 border-t border-slate-200">
                    <Button
                      data-testid="approve-initial"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleApproval('initial', 'approved')}
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Approve
                    </Button>
                    <Button
                      data-testid="reject-initial"
                      className="flex-1 bg-red-600 hover:bg-red-700"
                      onClick={() => handleApproval('initial', 'rejected')}
                    >
                      <X className="w-4 h-4 mr-1.5" />
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Second Pattern Review */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Second Pattern Review</CardTitle>
                    <CardDescription>Pattern Checker reviews and uploads corrections</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {order?.second_pattern_date && (
                      <Badge variant="secondary" className="text-xs">
                        {new Date(order.second_pattern_date).toLocaleDateString()}
                      </Badge>
                    )}
                    {order?.second_pattern_status && (
                      <Badge 
                        variant={order.second_pattern_status === 'approved' ? 'default' : 'destructive'}
                        className="text-xs capitalize"
                      >
                        {order.second_pattern_status}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderPatternSlots('second', patterns.second, canUploadSecondApproved)}
                
                {canApprove && !order?.second_pattern_status && (
                  <div className="flex gap-2 pt-4 border-t border-slate-200">
                    <Button
                      data-testid="approve-second"
                      disabled={order?.initial_pattern_status !== 'rejected'}
                      className={`flex-1 ${
                        order?.initial_pattern_status === 'rejected'
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      onClick={() => handleApproval('second', 'approved')}
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Approve
                    </Button>
                    <Button
                      data-testid="reject-second"
                      disabled={order?.initial_pattern_status !== 'rejected'}
                      className={`flex-1 ${
                        order?.initial_pattern_status === 'rejected'
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      onClick={() => handleApproval('second', 'rejected')}
                    >
                      <X className="w-4 h-4 mr-1.5" />
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Approved Pattern */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Final Approved Patterns</CardTitle>
                    <CardDescription>Final patterns after approval</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {order?.approved_pattern_date && (
                      <Badge variant="secondary" className="text-xs">
                        {new Date(order.approved_pattern_date).toLocaleDateString()}
                      </Badge>
                    )}
                    {order?.approved_pattern_status && (
                      <Badge 
                        variant={order.approved_pattern_status === 'approved' ? 'default' : 'destructive'}
                        className="text-xs capitalize"
                      >
                        {order.approved_pattern_status}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {renderPatternSlots('approved', patterns.approved, canUploadSecondApproved)}
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Chat */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24 h-[calc(100vh-7rem)]">
              <CardHeader className="border-b border-slate-200">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Order Chat
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex flex-col h-[calc(100%-5rem)]">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {chats.map((chat) => (
                      <div 
                        key={chat.id}
                        data-testid={`chat-message-${chat.id}`}
                        className={`flex flex-col ${
                          chat.user_id === user?.id ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div className="text-xs text-slate-500 mb-1">{chat.user_name}</div>
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 relative group ${
                            chat.user_id === user?.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-900'
                          }`}
                        >
                          {/* Quoted message */}
                          {chat.quoted_message_text && (
                            <div className={`mb-2 pb-2 border-l-2 pl-2 text-xs opacity-75 ${
                              chat.user_id === user?.id ? 'border-blue-300' : 'border-slate-400'
                            }`}>
                              <div className="font-semibold">{chat.quoted_user_name}</div>
                              <div className="truncate">{chat.quoted_message_text}</div>
                            </div>
                          )}
                          
                          <p className="text-sm">{chat.message}</p>
                          {chat.image_id && (
                            <img
                              src={`${API}/chat/images/${chat.image_id}`}
                              alt="Chat"
                              className="mt-2 rounded max-w-full"
                            />
                          )}
                          
                          {/* Reply button */}
                          <button
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/10"
                            onClick={() => setQuotedMessage({ id: chat.id, text: chat.message, user: chat.user_name })}
                            title="Reply to this message"
                          >
                            <Reply className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {typeof chat.created_at === 'string' 
                            ? new Date(chat.created_at).toLocaleTimeString()
                            : chat.created_at?.toLocaleTimeString 
                              ? chat.created_at.toLocaleTimeString()
                              : 'Just now'
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                
                <div className="p-4 border-t border-slate-200">
                  <form onSubmit={handleSendMessage} className="space-y-2">
                    {quotedMessage && (
                      <div className="bg-blue-50 border-l-2 border-blue-500 p-2 rounded text-sm flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-blue-900">Replying to {quotedMessage.user}</div>
                          <div className="text-slate-600 truncate">{quotedMessage.text}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setQuotedMessage(null)}
                          className="text-slate-400 hover:text-slate-600 ml-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <Textarea
                      data-testid="chat-input"
                      placeholder="Type your message..."
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      className="resize-none"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      {canUploadChatImage && (
                        <div className="flex-1 space-y-2">
                          <Input
                            id="chat-image-input"
                            type="file"
                            accept="image/*"
                            onChange={handleChatImageSelect}
                            className="text-xs"
                          />
                          {chatImagePreview && (
                            <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded flex items-center justify-between">
                              <span className="truncate">{chatImagePreview}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setChatImage(null);
                                  setChatImagePreview(null);
                                  const fileInput = document.getElementById('chat-image-input');
                                  if (fileInput) fileInput.value = '';
                                }}
                                className="text-green-700 hover:text-green-900 ml-2"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      <Button 
                        type="submit" 
                        data-testid="send-message"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OrderDetail;
