import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useContent } from '../hooks/useContent';
import AnimatedSection from '../components/AnimatedSection';
import LoadingSpinner from '../components/LoadingSpinner';
import { Calendar, Clock, User, ArrowRight, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

interface Booking {
  id: string;
  workspace_type: string;
  date: string;
  time_slot: string;
  duration: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_whatsapp: string;
  total_price: number;
  status: 'pending' | 'code_sent' | 'confirmed' | 'rejected' | 'cancelled';
  confirmation_code: string | null;
  created_at: string;
  updated_at: string;
}

const MyBookingsPage: React.FC = () => {
  const { user } = useAuth();
  const { getContent } = useContent();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'created_at' | 'price'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchBookings();
    }
  }, [user]);

  useEffect(() => {
    filterAndSortBookings();
  }, [bookings, statusFilter, sortBy, sortOrder]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load booking history');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortBookings = () => {
    let filtered = [...bookings];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(booking => booking.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case 'created_at':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        case 'price':
          aValue = a.total_price;
          bValue = b.total_price;
          break;
        default:
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredBookings(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'code_sent':
        return 'bg-blue-100 text-blue-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canResumeBooking = (booking: Booking) => {
    return booking.status === 'pending' || booking.status === 'code_sent';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Please log in to view your bookings</h2>
          <Link to="/login" className="bg-yellow-500 text-black px-6 py-3 rounded-md font-semibold hover:bg-yellow-600 transition-colors">
            Log In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <AnimatedSection animation="fadeIn" duration={800}>
        <section className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <AnimatedSection animation="slideUp" delay={200} duration={800}>
                <h1 className="text-4xl md:text-5xl font-bold mb-4">
                  My Bookings
                </h1>
              </AnimatedSection>
              <AnimatedSection animation="slideUp" delay={400} duration={800}>
                <p className="text-xl md:text-2xl max-w-3xl mx-auto">
                  View and manage your workspace reservations
                </p>
              </AnimatedSection>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Bookings Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filters and Sorting */}
          <AnimatedSection animation="slideUp" duration={600}>
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Filter className="w-5 h-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Filter & Sort:</span>
                </div>
                
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value="all">All Status</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                    <option value="code_sent">Code Sent</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  {/* Sort By */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'date' | 'created_at' | 'price')}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value="created_at">Sort by Booking Date</option>
                    <option value="date">Sort by Event Date</option>
                    <option value="price">Sort by Price</option>
                  </select>

                  {/* Sort Order */}
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value="desc">Newest First</option>
                    <option value="asc">Oldest First</option>
                  </select>
                </div>
              </div>
            </div>
          </AnimatedSection>

          {/* Bookings List */}
          {loading ? (
            <LoadingSpinner size="lg" text="Loading your bookings..." />
          ) : filteredBookings.length === 0 ? (
            <AnimatedSection animation="slideUp" duration={600}>
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {statusFilter === 'all' ? 'No bookings found' : `No ${statusFilter} bookings found`}
                </h3>
                <p className="text-gray-600 mb-6">
                  {statusFilter === 'all' 
                    ? "You haven't made any bookings yet. Start by booking your first workspace!"
                    : `You don't have any ${statusFilter} bookings. Try changing the filter or make a new booking.`
                  }
                </p>
                <Link
                  to="/booking"
                  className="bg-yellow-500 text-black px-6 py-3 rounded-md font-semibold hover:bg-yellow-600 transition-colors inline-flex items-center"
                >
                  Book a Workspace
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </div>
            </AnimatedSection>
          ) : (
            <div className="space-y-6">
              {filteredBookings.map((booking, index) => (
                <AnimatedSection 
                  key={booking.id}
                  animation="slideUp" 
                  delay={index * 100} 
                  duration={600}
                >
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {booking.workspace_type}
                            </h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(booking.status)}`}>
                              {booking.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-2" />
                              {new Date(booking.date).toLocaleDateString()}
                            </div>
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 mr-2" />
                              {booking.time_slot} ({booking.duration})
                            </div>
                            <div className="flex items-center">
                              <User className="w-4 h-4 mr-2" />
                              E£{booking.total_price}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 md:mt-0 flex flex-col md:flex-row gap-2">
                          {canResumeBooking(booking) && (
                            <Link
                              to={`/confirmation?bookingId=${booking.id}`}
                              className="bg-yellow-500 text-black px-4 py-2 rounded-md text-sm font-semibold hover:bg-yellow-600 transition-colors inline-flex items-center justify-center"
                            >
                              Resume Booking
                              <ArrowRight className="w-4 h-4 ml-1" />
                            </Link>
                          )}
                          
                          <button
                            onClick={() => setExpandedBooking(expandedBooking === booking.id ? null : booking.id)}
                            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                          >
                            {expandedBooking === booking.id ? 'Hide Details' : 'View Details'}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedBooking === booking.id && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900 mb-3">Booking Details</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Booking ID:</span>
                                  <span className="font-mono text-xs">{booking.id}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Booked on:</span>
                                  <span>{new Date(booking.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Duration:</span>
                                  <span>{booking.duration}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Total Price:</span>
                                  <span className="font-semibold">E£{booking.total_price}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900 mb-3">Contact Information</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Name:</span>
                                  <span>{booking.customer_name}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Email:</span>
                                  <span>{booking.customer_email}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Phone:</span>
                                  <span>{booking.customer_phone}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">WhatsApp:</span>
                                  <span>{booking.customer_whatsapp}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default MyBookingsPage;