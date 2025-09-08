// Enhanced state updates
      setDetectedObjects(response.data.objects || []);
      setObjectCount(response.data.object_count || 0);
      setDetectionMethod(response.data.detection_method || 'Unknown');
      
      const resultText = response.data.objects?.join(', ') || 'Nothing';
      setAiResponse(`Detected: ${resultText}`);
      
      // Add to analysis history
      setAnalysisHistory(prev => {
        const newHistory = [`${new Date().toLocaleTimeString()}: ${resultText}`, ...prev];
        return newHistory.slice(0, 5); // Keep last 5 analyses
      });
      
    } catch (error) {
      setAiResponse('Analysis failed - Check backend connection');
    }
  };

  const toggleAutoAnalysis = () => {
    setAutoAnalysis(!autoAnalysis);
    if (!autoAnalysis) {
      setAiResponse('Auto-analysis started - Monitoring every 2 seconds');
    } else {
      setAiResp