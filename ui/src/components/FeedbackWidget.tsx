import React, { useState, useEffect } from 'react';
import { Star, ThumbsUp, ThumbsDown, Edit, Tag } from 'lucide-react';

interface FeedbackRequest {
  id: string;
  agentId: string;
  requestId: string;
  userRequest: string;
  agentResponse: any;
  timestamp: Date;
  feedbackType: 'rating' | 'correction' | 'preference' | 'label';
}

interface FeedbackWidgetProps {
  request?: FeedbackRequest;
  onSubmit: (feedback: any) => void;
  onDismiss?: () => void;
}

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({
  request,
  onSubmit,
  onDismiss
}) => {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [correctedResponse, setCorrectedResponse] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [comments, setComments] = useState('');
  const [showCorrection, setShowCorrection] = useState(false);
  const [showLabels, setShowLabels] = useState(false);

  const commonLabels = [
    'accurate',
    'helpful',
    'clear',
    'incomplete',
    'confusing',
    'incorrect',
    'slow',
    'off-topic'
  ];

  const handleSubmit = () => {
    if (!request) return;

    const feedback: any = {
      feedbackId: `feedback_${Date.now()}`,
      requestId: request.requestId,
      feedbackType: request.feedbackType || 'rating',
      timestamp: new Date()
    };

    if (rating > 0) {
      feedback.rating = rating;
    }

    if (correctedResponse) {
      feedback.correctedResponse = correctedResponse;
      feedback.feedbackType = 'correction';
    }

    if (labels.length > 0) {
      feedback.labels = labels;
    }

    if (comments) {
      feedback.comments = comments;
    }

    onSubmit(feedback);
  };

  const toggleLabel = (label: string) => {
    setLabels(prev => 
      prev.includes(label) 
        ? prev.filter(l => l !== label)
        : [...prev, label]
    );
  };

  if (!request) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 p-6 z-50">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          How was this response?
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Your feedback helps improve our AI agents
        </p>
      </div>

      {/* User Request */}
      <div className="mb-4 p-3 bg-gray-50 rounded-md">
        <p className="text-sm text-gray-700">
          <span className="font-medium">You asked:</span> {request.userRequest}
        </p>
      </div>

      {/* Agent Response */}
      <div className="mb-4 p-3 bg-blue-50 rounded-md max-h-32 overflow-y-auto">
        <p className="text-sm text-gray-700">
          <span className="font-medium">{request.agentId} responded:</span>
        </p>
        <p className="text-sm text-gray-600 mt-1">
          {typeof request.agentResponse === 'string' 
            ? request.agentResponse 
            : JSON.stringify(request.agentResponse, null, 2)}
        </p>
      </div>

      {/* Rating Stars */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="transition-colors"
            >
              <Star
                size={24}
                className={`${
                  star <= (hoveredRating || rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                } transition-colors cursor-pointer`}
              />
            </button>
          ))}
          <span className="text-sm text-gray-600 ml-2">
            {rating > 0 && (
              rating === 1 ? 'Poor' :
              rating === 2 ? 'Fair' :
              rating === 3 ? 'Good' :
              rating === 4 ? 'Very Good' :
              'Excellent'
            )}
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowCorrection(!showCorrection)}
          className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm ${
            showCorrection
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Edit size={14} />
          Correct Response
        </button>
        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm ${
            showLabels
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Tag size={14} />
          Add Labels
        </button>
      </div>

      {/* Correction Input */}
      {showCorrection && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Provide the correct response:
          </label>
          <textarea
            value={correctedResponse}
            onChange={(e) => setCorrectedResponse(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            rows={3}
            placeholder="Type the response you expected..."
          />
        </div>
      )}

      {/* Labels */}
      {showLabels && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select applicable labels:
          </label>
          <div className="flex flex-wrap gap-2">
            {commonLabels.map(label => (
              <button
                key={label}
                onClick={() => toggleLabel(label)}
                className={`px-3 py-1 rounded-full text-sm ${
                  labels.includes(label)
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Additional comments (optional):
        </label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          rows={2}
          placeholder="Any other feedback..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={onDismiss}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
        >
          Skip
        </button>
        <button
          onClick={handleSubmit}
          disabled={rating === 0 && !correctedResponse && labels.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Submit Feedback
        </button>
      </div>
    </div>
  );
};

// Feedback Manager Component
export const FeedbackManager: React.FC = () => {
  const [pendingRequests, setPendingRequests] = useState<FeedbackRequest[]>([]);
  const [currentRequest, setCurrentRequest] = useState<FeedbackRequest | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    const websocket = new WebSocket(`ws://localhost:8080/api/v1/feedback/live`);
    
    websocket.onopen = () => {
      console.log('Connected to feedback service');
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'new_feedback_request') {
        setPendingRequests(prev => [...prev, message.data]);
        if (!currentRequest) {
          setCurrentRequest(message.data);
        }
      } else if (message.type === 'pending_feedback') {
        setPendingRequests(message.data);
        if (message.data.length > 0 && !currentRequest) {
          setCurrentRequest(message.data[0]);
        }
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, []);

  const handleSubmit = async (feedback: any) => {
    try {
      const response = await fetch('/api/v1/feedback/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedback),
      });

      if (response.ok) {
        // Move to next request
        const nextIndex = pendingRequests.findIndex(r => r.id === currentRequest?.id) + 1;
        if (nextIndex < pendingRequests.length) {
          setCurrentRequest(pendingRequests[nextIndex]);
        } else {
          setCurrentRequest(null);
        }
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const handleDismiss = () => {
    const nextIndex = pendingRequests.findIndex(r => r.id === currentRequest?.id) + 1;
    if (nextIndex < pendingRequests.length) {
      setCurrentRequest(pendingRequests[nextIndex]);
    } else {
      setCurrentRequest(null);
    }
  };

  // Show feedback count badge
  if (pendingRequests.length > 0 && !currentRequest) {
    return (
      <button
        onClick={() => setCurrentRequest(pendingRequests[0])}
        className="fixed bottom-4 right-4 bg-blue-600 text-white rounded-full px-4 py-2 shadow-lg hover:bg-blue-700 flex items-center gap-2"
      >
        <span className="text-sm">Provide Feedback</span>
        <span className="bg-white text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
          {pendingRequests.length}
        </span>
      </button>
    );
  }

  return (
    <FeedbackWidget
      request={currentRequest || undefined}
      onSubmit={handleSubmit}
      onDismiss={handleDismiss}
    />
  );
};