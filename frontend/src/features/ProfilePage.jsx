// src/features/profile/ProfilePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { auth, db, app } from './../firebase'; // Assuming firebase.js is in src/, so relative path ../../firebase
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth'; // Keep for direct auth state observation if needed
import { useAuth } from './../contexts/AuthContext';
import '../styles/ProfilePage.css';

const ProfilePage = () => {
  const { markProfileAsCompleted, currentUser: authContextUser, profileChecked } = useAuth(); // Use authContextUser and profileChecked

  const [user, setUser] = useState(null); // Keep local user state for this component
  const [profileData, setProfileData] = useState({
    displayName: '',
    phoneNumber: '',
    address: '',
    email: '',
    dateOfBirth: '',
    gender: '',
    allergies: '',
    medicalConditions: '',
    currentMedications: '',
    preferredDeliveryAddress: { street: '', city: '', postalCode: '', country: '' },
    deliveryInstructions: '',
    insuranceProvider: '',
    insurancePolicyNumber: '',
    communicationPreferences: { emailNotifications: true, smsReminders: false, marketingOptIn: false },
    emergencyContact: { name: '', phoneNumber: '', relationship: '', email: '' } // NEW: Added email field
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const appId = app?.options?.projectId || 'default-app-id';
  console.log('ProfilePage: Using Firebase Project ID as App ID for Firestore path:', appId);

  // This effect listens to changes in AuthContext's currentUser
  // and the profileChecked flag to trigger data fetching
  useEffect(() => {
    console.log(`ProfilePage: useEffect triggered. authContextUser: ${authContextUser?.uid}, profileChecked: ${profileChecked}`);
    if (profileChecked) { // Only proceed after AuthContext has completed its profile check
      if (authContextUser && authContextUser.uid) {
        setUser(authContextUser); // Set local user state
        setProfileData(prev => ({ ...prev, email: authContextUser.email || '' }));
        fetchProfileData(authContextUser.uid);
      } else {
        console.log('ProfilePage: No user logged in or UID missing after profileChecked.');
        setUser(null);
        setLoading(false);
        setError('Please log in to view your profile.');
      }
    }
  }, [authContextUser, profileChecked, appId]); // Depend on authContextUser, profileChecked, and appId

  const fetchProfileData = async (uid) => {
    setLoading(true);
    setError('');
    setMessage('');

    if (!db) {
      setError('ProfilePage: Firestore database not available. Cannot fetch profile.');
      setLoading(false);
      return;
    }
    if (!uid) {
      console.error('ProfilePage: fetchProfileData called with null/undefined UID. Cannot fetch profile.');
      setError('User ID is missing. Cannot fetch profile data.');
      setLoading(false);
      return;
    }

    try {
      console.log(`ProfilePage: Attempting to fetch profile for user UID: ${uid} in app ID: ${appId}`);
      const userProfileDocRef = doc(db, `artifacts/${appId}/users/${uid}/profile_data`, uid);
      const docSnap = await getDoc(userProfileDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('ProfilePage: Profile data fetched:', data);
        setProfileData(prev => ({
          ...prev,
          displayName: data.displayName || '',
          phoneNumber: data.phoneNumber || '',
          address: data.address || '',
          dateOfBirth: data.dateOfBirth?.toDate ? data.dateOfBirth.toDate().toISOString().split('T')[0] : data.dateOfBirth || '',
          gender: data.gender || '',
          allergies: Array.isArray(data.allergies) ? data.allergies.join(', ') : data.allergies || '',
          medicalConditions: Array.isArray(data.medicalConditions) ? data.medicalConditions.join(', ') : data.medicalConditions || '',
          currentMedications: Array.isArray(data.currentMedications) ? data.currentMedications.join(', ') : data.currentMedications || '',
          preferredDeliveryAddress: (typeof data.preferredDeliveryAddress === 'object' && data.preferredDeliveryAddress !== null) ? data.preferredDeliveryAddress : { street: '', city: '', postalCode: '', country: '' },
          deliveryInstructions: data.deliveryInstructions || '',
          insuranceProvider: data.insuranceProvider || '',
          insurancePolicyNumber: data.insurancePolicyNumber || '',
          communicationPreferences: (typeof data.communicationPreferences === 'object' && data.communicationPreferences !== null) ? data.communicationPreferences : { emailNotifications: true, smsReminders: false, marketingOptIn: false },
          emergencyContact: (typeof data.emergencyContact === 'object' && data.emergencyContact !== null) ? data.emergencyContact : { name: '', phoneNumber: '', relationship: '', email: '' } // NEW: Ensure email is initialized
        }));
        setMessage('Profile data loaded.');
      } else {
        console.log('ProfilePage: No existing profile data found for user UID:', uid);
        setMessage('No existing profile data found. Please fill in your details.');
      }
    } catch (err) {
      console.error('ProfilePage: Error fetching profile data from Firestore:', err);
      setError(`Failed to load profile data: ${err.message}. Please check Firestore rules and network.`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNestedChange = (parentField, childField, value) => {
    setProfileData(prev => ({
      ...prev,
      [parentField]: {
        ...prev[parentField],
        [childField]: value
      }
    }));
  };

  const handleCommunicationChange = (e) => {
    const { name, checked } = e.target;
    setProfileData(prev => ({
      ...prev,
      communicationPreferences: {
        ...prev.communicationPreferences,
        [name]: checked
      }
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!user || !user.uid) {
      console.error('ProfilePage: handleSave called without a valid user or UID.');
      setError('You must be logged in to save your profile.');
      return;
    }
    if (!db) {
      setError('ProfilePage: Firestore database not available. Cannot save profile.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      console.log(`ProfilePage: Attempting to save profile for user UID: ${user.uid}`);
      const userProfileDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile_data`, user.uid);
      
      const dataToSave = {
        displayName: profileData.displayName,
        phoneNumber: profileData.phoneNumber,
        address: profileData.address,
        email: user.email,
        dateOfBirth: profileData.dateOfBirth,
        gender: profileData.gender,
        allergies: profileData.allergies.split(',').map(item => item.trim()).filter(item => item),
        medicalConditions: profileData.medicalConditions.split(',').map(item => item.trim()).filter(item => item),
        currentMedications: profileData.currentMedications.split(',').map(item => item.trim()).filter(item => item),
        preferredDeliveryAddress: profileData.preferredDeliveryAddress,
        deliveryInstructions: profileData.deliveryInstructions,
        insuranceProvider: profileData.insuranceProvider,
        insurancePolicyNumber: profileData.insurancePolicyNumber,
        communicationPreferences: profileData.communicationPreferences,
        emergencyContact: profileData.emergencyContact // Ensure emergencyContact object is saved
      };

      await setDoc(userProfileDocRef, dataToSave, { merge: true });
      setMessage('Profile updated successfully!');
      console.log('ProfilePage: Profile saved successfully.');
      
      markProfileAsCompleted();

    } catch (err) {
      console.error('ProfilePage: Error saving profile data to Firestore:', err);
      setError(`Failed to save profile data: ${err.message}. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh',
        backgroundColor: '#2d3748', color: '#f8f9fa', fontSize: '1.5rem', padding: '20px'
      }}>
        Loading profile...
      </div>
    );
  }

  if (error || !user) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        minHeight: '100vh', backgroundColor: '#2d3748', color: '#f8f9fa',
        fontSize: '1.2rem', padding: '20px', textAlign: 'center'
      }}>
        <p style={{ color: '#ff6b6b', marginBottom: '10px' }}>{error || 'Error: User not authenticated.'}</p>
        {!user && <p>Please ensure you are logged in to access this page.</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-2xl border border-gray-700">
        <h1 className="text-3xl font-bold text-center text-white mb-6">My Profile</h1>
        
        {message && (
          <div className="bg-green-700 text-green-200 p-3 rounded-md mb-4 text-sm text-center">
            {message}
          </div>
        )}
        {error && (
          <div className="bg-red-900 text-red-300 p-3 rounded-md mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1">Email (Fixed)</label>
              <input
                type="email"
                id="email"
                name="email"
                value={profileData.email}
                readOnly
                className="mt-1 block w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-400 mb-1">Display Name</label>
              <input
                type="text"
                id="displayName"
                name="displayName"
                value={profileData.displayName}
                onChange={handleChange}
                className="mt-1 block w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-400 mb-1">Phone Number</label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={profileData.phoneNumber}
                onChange={handleChange}
                className="mt-1 block w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., +1 (555) 123-4567"
              />
            </div>

            <div>
              <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-400 mb-1">Date of Birth</label>
              <input
                type="date"
                id="dateOfBirth"
                name="dateOfBirth"
                value={profileData.dateOfBirth}
                onChange={handleChange}
                className="mt-1 block w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder=""
              />
            </div>

            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-gray-400 mb-1">Gender</label>
              <select
                id="gender"
                name="gender"
                value={profileData.gender}
                onChange={handleChange}
                className="mt-1 block w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div className="bg-gray-700 p-5 rounded-lg border border-gray-600 space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Health Information</h2>
            <div>
              <label htmlFor="allergies" className="block text-sm font-medium text-gray-400 mb-1">Allergies (comma-separated)</label>
              <textarea
                id="allergies"
                name="allergies"
                value={profileData.allergies}
                onChange={handleChange}
                rows="2"
                className="mt-1 block w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                placeholder="e.g., Penicillin, Peanuts, Aspirin"
              ></textarea>
            </div>

            <div>
              <label htmlFor="medicalConditions" className="block text-sm font-medium text-gray-400 mb-1">Medical Conditions (comma-separated)</label>
              <textarea
                id="medicalConditions"
                name="medicalConditions"
                value={profileData.medicalConditions}
                onChange={handleChange}
                rows="2"
                className="mt-1 block w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                placeholder="e.g., Diabetes, Hypertension, Asthma"
              ></textarea>
            </div>

            <div>
              <label htmlFor="currentMedications" className="block text-sm font-medium text-gray-400 mb-1">Current Medications (comma-separated)</label>
              <textarea
                id="currentMedications"
                name="currentMedications"
                value={profileData.currentMedications}
                onChange={handleChange}
                rows="2"
                className="mt-1 block w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                placeholder="e.g., Metformin 500mg, Lisinopril 10mg"
              ></textarea>
            </div>
          </div>

          <div className="bg-gray-700 p-5 rounded-lg border border-gray-600 space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Address & Delivery</h2>
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-400 mb-1">Primary Address</label>
              <textarea
                id="address"
                name="address"
                value={profileData.address}
                onChange={handleChange}
                rows="3"
                className="mt-1 block w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                placeholder="Enter your full primary address"
              ></textarea>
            </div>

            <h3 className="text-lg font-medium text-gray-300 mt-5">Preferred Delivery Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="deliveryStreet" className="block text-sm font-medium text-gray-400 mb-1">Street</label>
                    <input
                        type="text"
                        id="deliveryStreet"
                        name="street"
                        value={profileData.preferredDeliveryAddress.street}
                        onChange={(e) => handleNestedChange('preferredDeliveryAddress', 'street', e.target.value)}
                        className="mt-1 block w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., 123 Main St"
                    />
                </div>
                <div>
                    <label htmlFor="deliveryCity" className="block text-sm font-medium text-gray-400 mb-1">City</label>
                    <input
                        type="text"
                        id="deliveryCity"
                        name="city"
                        value={profileData.preferredDeliveryAddress.city}
                        onChange={(e) => handleNestedChange('preferredDeliveryAddress', 'city', e.target.value)}
                        className="mt-1 block w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Springfield"
                    />
                </div>
                <div>
                    <label htmlFor="deliveryPostalCode" className="block text-sm font-medium text-gray-400 mb-1">Postal Code</label>
                    <input
                        type="text"
                        id="deliveryPostalCode"
                        name="postalCode"
                        value={profileData.preferredDeliveryAddress.postalCode}
                        onChange={(e) => handleNestedChange('preferredDeliveryAddress', 'postalCode', e.target.value)}
                        className="mt-1 block w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., 98765"
                    />
                </div>
                <div>
                    <label htmlFor="deliveryCountry" className="block text-sm font-medium text-gray-400 mb-1">Country</label>
                    <input
                        type="text"
                        id="deliveryCountry"
                        name="country"
                        value={profileData.preferredDeliveryAddress.country}
                        onChange={(e) => handleNestedChange('preferredDeliveryAddress', 'country', e.target.value)}
                        className="mt-1 block w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., USA"
                    />
                </div>
            </div>

            <div>
              <label htmlFor="deliveryInstructions" className="block text-sm font-medium text-gray-400 mb-1">Delivery Instructions</label>
              <textarea
                id="deliveryInstructions"
                name="deliveryInstructions"
                value={profileData.deliveryInstructions}
                onChange={handleChange}
                rows="2"
                className="mt-1 block w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                placeholder="e.g., Leave at back door, ring twice"
              ></textarea>
            </div>
          </div>

          <div className="bg-gray-700 p-5 rounded-lg border border-gray-600 space-y-3">
            <h2 className="text-xl font-semibold text-white mb-4">Communication Preferences</h2>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="emailNotifications"
                name="emailNotifications"
                checked={profileData.communicationPreferences.emailNotifications}
                onChange={handleCommunicationChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="emailNotifications" className="ml-2 block text-sm text-gray-300">Email Notifications</label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="smsReminders"
                name="smsReminders"
                checked={profileData.communicationPreferences.smsReminders}
                onChange={handleCommunicationChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="smsReminders" className="ml-2 block text-sm text-gray-300">SMS Reminders</label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="marketingOptIn"
                name="marketingOptIn"
                checked={profileData.communicationPreferences.marketingOptIn}
                onChange={handleCommunicationChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="marketingOptIn" className="ml-2 block text-sm text-gray-300">Receive Marketing Communications</label>
            </div>
          </div>

          <div className="bg-gray-700 p-5 rounded-lg border border-gray-600 space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Emergency Contact</h2>
            <div>
                <label htmlFor="emergencyName" className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                <input
                    type="text"
                    id="emergencyName"
                    name="name"
                    value={profileData.emergencyContact.name}
                    onChange={(e) => handleNestedChange('emergencyContact', 'name', e.target.value)}
                    className="mt-1 block w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Emergency contact name"
                />
            </div>
            <div>
                <label htmlFor="emergencyPhoneNumber" className="block text-sm font-medium text-gray-400 mb-1">Phone Number</label>
                <input
                    type="tel"
                    id="emergencyPhoneNumber"
                    name="phoneNumber"
                    value={profileData.emergencyContact.phoneNumber}
                    onChange={(e) => handleNestedChange('emergencyContact', 'phoneNumber', e.target.value)}
                    className="mt-1 block w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Emergency contact phone"
                />
            </div>
            {/* NEW: Emergency Contact Email Input Field */}
            <div>
                <label htmlFor="emergencyEmail" className="block text-sm font-medium text-gray-400 mb-1">Email for Emergency Alerts</label>
                <input
                    type="email"
                    id="emergencyEmail"
                    name="email"
                    value={profileData.emergencyContact.email}
                    onChange={(e) => handleNestedChange('emergencyContact', 'email', e.target.value)}
                    className="mt-1 block w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Emergency contact email"
                />
            </div>
            <div>
                <label htmlFor="emergencyRelationship" className="block text-sm font-medium text-gray-400 mb-1">Relationship</label>
                <input
                    type="text"
                    id="emergencyRelationship"
                    name="relationship"
                    value={profileData.emergencyContact.relationship}
                    onChange={(e) => handleNestedChange('emergencyContact', 'relationship', e.target.value)}
                    className="mt-1 block w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Spouse, Parent"
                />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition duration-150 ease-in-out text-lg"
            disabled={saving}
          >
            {saving ? 'Saving Profile...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage