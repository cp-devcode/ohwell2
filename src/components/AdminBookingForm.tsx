import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, Mail, MessageCircle, X } from 'lucide-react';
import { useBooking } from '../contexts/BookingContext';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase'; // assuming supabase is configured like in the working code

// Helper function to convert duration to hours
const convertDurationToHours = (duration: string, totalSlots: number): number => {
  switch (duration) {
    case '1-hour':
      return 1;
    case '2-hours':
      return 2;
    case '4-hours':
      return 4;
    case '1-day':
      return totalSlots; // Full day = all available hourly slots
    case '1-week':
      return totalSlots * 7;
    case '1-month':
      return totalSlots * 30;
    default:
      return 1;
  }
};

const AdminBookingForm: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
}> = ({ onClose, onSuccess }) => {
  const { createAdminBooking } = useBooking();
  const [workspaceTypes, setWorkspaceTypes] = useState([]);
  const [hourlySlots, setHourlySlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [formData, setFormData] = useState({
    workspaceType: '',
    date: '',
    timeSlot: '',
    duration: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerWhatsapp: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const totalDesks = 6; // Assuming this is fixed, like in the working example

  const durations = [
    { value: '1-hour', label: '1 Hour', multiplier: 1 },
    { value: '2-hours', label: '2 Hours', multiplier: 2 },
    { value: '4-hours', label: '4 Hours', multiplier: 4 },
    { value: '1-day', label: '1 Day', multiplier: 1 },
    { value: '1-week', label: '1 Week', multiplier: 7 },
    { value: '1-month', label: '1 Month', multiplier: 30 },
  ];

  // Fetch workspace types and hourly slots
  useEffect(() => {
    fetchWorkspaceTypes();
  }, []);

  useEffect(() => {
    if (formData.workspaceType && formData.date && formData.duration) {
      fetchBookedSlots();
    } else {
      setBookedSlots([]);
    }
  }, [formData.workspaceType, formData.date, formData.duration]);

  // Fetch workspace types from the database
  const fetchWorkspaceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('workspace_types')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) throw error;

      setWorkspaceTypes(data || []);
      setHourlySlots(['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM']); // Example slots, you can customize
    } catch (error) {
      console.error('Error fetching workspace types:', error);
    }
  };

  // Fetch booked slots based on selected workspace type, date, and duration
  const fetchBookedSlots = async () => {
    setCheckingAvailability(true);

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('time_slot, duration, desk_number')
        .eq('workspace_type', formData.workspaceType)
        .eq('date', formData.date)
        .in('status', ['pending', 'confirmed', 'code_sent']);

      if (error) throw error;

      const requestedDurationHours = convertDurationToHours(formData.duration, hourlySlots.length);
      const deskAvailabilityMatrix = new Map<string, boolean[]>();

      // Initialize availability matrix with all desks being available
      hourlySlots.forEach((slot) => {
        deskAvailabilityMatrix.set(slot, new Array(totalDesks).fill(true));
      });

      // Mark desks as unavailable based on existing bookings
      data?.forEach((booking) => {
        const bookingDurationHours = convertDurationToHours(booking.duration, hourlySlots.length);
        const occupiedSlots = getHourlySlotsForBooking(booking.time_slot, bookingDurationHours, hourlySlots);

        occupiedSlots.forEach((slot) => {
          const availability = deskAvailabilityMatrix.get(slot);
          if (availability) {
            if (booking.desk_number !== null && booking.desk_number >= 1 && booking.desk_number <= totalDesks) {
              availability[booking.desk_number - 1] = false;
            } else {
              availability.fill(false);
            }
          }
        });
      });

      // Check for unavailable slots
      const unavailableSlots: string[] = [];

      hourlySlots.forEach((startSlot) => {
        const requiredSlots = getHourlySlotsForBooking(startSlot, requestedDurationHours, hourlySlots);
        if (requiredSlots.length < requestedDurationHours) {
          unavailableSlots.push(startSlot);
          return;
        }

        let hasAvailableDesk = false;
        for (let deskIndex = 0; deskIndex < totalDesks; deskIndex++) {
          let deskAvailableForAllSlots = true;
          for (const slot of requiredSlots) {
            const availability = deskAvailabilityMatrix.get(slot);
            if (!availability || !availability[deskIndex]) {
              deskAvailableForAllSlots = false;
              break;
            }
          }
          if (deskAvailableForAllSlots) {
            hasAvailableDesk = true;
            break;
          }
        }

        if (!hasAvailableDesk) {
          unavailableSlots.push(startSlot);
        }
      });

      setBookedSlots(unavailableSlots);
    } catch (error) {
      console.error('Error fetching booked slots:', error);
      setBookedSlots([]);
    } finally {
      setCheckingAvailability(false);
    }
  };

  const getHourlySlotsForBooking = (startSlot: string, durationHours: number, allSlots: string[]): string[] => {
    const startIndex = allSlots.indexOf(startSlot);
    if (startIndex === -1) return [];
    return allSlots.slice(startIndex, startIndex + durationHours);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if ((name === 'workspaceType' || name === 'date' || name === 'duration') && formData.timeSlot) {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        timeSlot: '', // Reset time slot when dependencies change
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const calculatePrice = () => {
    const workspace = workspaceTypes.find((w) => w.name === formData.workspaceType);
    const duration = durations.find((d) => d.value === formData.duration);
    if (!workspace || !duration) return 0;
    return workspace.price * duration.multiplier;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const totalPrice = calculatePrice();
      const bookingData = { ...formData, totalPrice };
      await createAdminBooking(bookingData);

      toast.success('Booking created successfully!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating admin booking:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Create New Booking</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Workspace Selection */}
            <div>
              <h3 className="text-lg font-semibold text-black mb-4 flex items-center">
                <User className="w-5 h-5 mr-2" />
                Select Workspace Type
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {workspaceTypes.length === 0 ? (
                  <div className="col-span-full text-center py-8">
                    <p className="text-gray-500">No workspace types available.</p>
                  </div>
                ) : (
                  workspaceTypes.map((workspace) => (
                    <label
                      key={workspace.name}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all duration-300 block ${
                        formData.workspaceType === workspace.name
                          ? 'border-yellow-500 bg-yellow-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="workspaceType"
                        value={workspace.name}
                        checked={formData.workspaceType === workspace.name}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      <div className="text-center space-y-2">
                        <h4 className="font-semibold text-black">{workspace.name}</h4>
                        <p className="text-gray-600 text-sm">{workspace.description}</p>
                        <div className="text-yellow-600 font-bold">E£{workspace.price}/{workspace.price_unit}</div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Date & Duration Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Select Date
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration
                </label>
                <select
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="">Select duration</option>
                  {durations.map((duration) => (
                    <option key={duration.value} value={duration.value}>
                      {duration.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Time Slot Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-2" />
                Select Time Slot {checkingAvailability && <span className="text-yellow-500">(Checking availability...)</span>}
              </label>
              <select
                name="timeSlot"
                value={formData.timeSlot}
                onChange={handleChange}
                required
                disabled={!formData.workspaceType || !formData.date || !formData.duration || checkingAvailability}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                <option value="">
                  {!formData.workspaceType || !formData.date || !formData.duration
                    ? 'Select workspace, date, and duration first'
                    : checkingAvailability
                    ? 'Checking availability...'
                    : 'Choose available time slot'}
                </option>
                {hourlySlots
                  .filter(slot => !bookedSlots.includes(slot))
                  .map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
              </select>
              {formData.workspaceType && formData.date && formData.duration && bookedSlots.length > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Unavailable slots for {formData.duration}: {bookedSlots.join(', ')}
                </p>
              )}
              {formData.workspaceType && formData.date && formData.duration && bookedSlots.length === hourlySlots.length && (
                <p className="text-sm text-red-500 mt-1">
                  No available slots for this date and duration. Please choose a different date or shorter duration.
                </p>
              )}
            </div>

            {/* Customer Information */}
            <div>
              <h3 className="text-lg font-semibold text-black mb-4">Customer Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="w-4 h-4 inline mr-2" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="customerEmail"
                    value={formData.customerEmail}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="w-4 h-4 inline mr-2" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="customerPhone"
                    value={formData.customerPhone}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MessageCircle className="w-4 h-4 inline mr-2" />
                    WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    name="customerWhatsapp"
                    value={formData.customerWhatsapp}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
              </div>
            </div>

            {/* Price Summary */}
            {formData.workspaceType && formData.duration && (
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-black mb-2">Price Summary</h3>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Cost:</span>
                  <span className="text-2xl font-bold text-yellow-600">E£{calculatePrice()}</span>
                </div>
                {formData.timeSlot && (
                  <div className="mt-2 text-sm text-gray-600">
                    <p>Workspace: {formData.workspaceType}</p>
                    <p>Duration: {durations.find(d => d.value === formData.duration)?.label}</p>
                    <p>Time: {formData.timeSlot}</p>
                  </div>
                )}
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || bookedSlots.length === hourlySlots.length}
                className="bg-yellow-500 text-black px-6 py-2 rounded-md font-semibold hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2 inline-block"></div>
                    Creating Booking...
                  </>
                ) : (
                  'Create Booking'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminBookingForm;
