/**
 * Event Monitor Module for VideoJS IMA DAI
 * Provides comprehensive event logging and monitoring capabilities
 */
class EventMonitor {
  constructor(containerId = 'eventLog') {
    this.containerId = containerId;
    this.eventLog = document.getElementById(containerId);
    this.init();
  }

  init() {
    if (!this.eventLog) {
      console.warn('Event log container not found');
      return;
    }
    this.logEvent('monitor', 'Event Monitor initialized');
  }

  /**
   * Log an event with timestamp and category
   * @param {string} type - Event type
   * @param {string} message - Event message
   * @param {string} category - Event category (player, ad, newrelic, error)
   */
  logEvent(type, message, category = 'player') {
    const timestamp = new Date().toLocaleTimeString() + '.' + 
                     new Date().getMilliseconds().toString().padStart(3, '0');
    
    if (!this.eventLog) return;

    const eventItem = document.createElement('div');
    eventItem.className = 'event-item';
    
    let categoryClass = 'event-player';
    if (category === 'ad') categoryClass = 'event-ad';
    else if (category === 'newrelic') categoryClass = 'event-newrelic';
    else if (category === 'error') categoryClass = 'event-error';
    else if (category === 'dai') categoryClass = 'event-ad';
    
    eventItem.innerHTML = `
      <span class="event-timestamp">[${timestamp}]</span> 
      <span class="event-type ${categoryClass}">[${type.toUpperCase()}]</span> 
      ${message}
    `;
    
    this.eventLog.appendChild(eventItem);
    this.eventLog.scrollTop = this.eventLog.scrollHeight;
    
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
  }

  /**
   * Setup comprehensive event monitoring for VideoJS player
   * @param {Object} player - VideoJS player instance
   */
  setupPlayerMonitoring(player) {
    if (!player) {
      this.logEvent('error', 'No player provided for monitoring', 'error');
      return;
    }

    // Basic player events
    const playerEvents = [
      'loadstart', 'loadeddata', 'loadedmetadata', 'canplay', 'canplaythrough',
      'play', 'playing', 'pause', 'ended', 'seeking', 'seeked',
      'volumechange', 'waiting', 'stalled', 'suspend', 'abort', 'emptied',
      'ratechange', 'resize', 'texttrackchange', 'error'
    ];

    playerEvents.forEach(event => {
      player.on(event, (e) => {
        if (event === 'error') {
          const error = player.error();
          this.logEvent(event, `Player error: ${error?.message || 'Unknown error'}`, 'error');
        } else {
          this.logEvent(event, `Player ${event} event`);
        }
      });
    });

    this.logEvent('monitoring', 'Player event monitoring setup complete');
  }

  /**
   * Setup DAI-specific event monitoring
   * @param {Object} player - VideoJS player instance
   */
  setupDAIMonitoring(player) {
    if (!player || !player.ima) {
      this.logEvent('error', 'IMA plugin not available for DAI monitoring', 'error');
      return;
    }

    // DAI specific events
    const daiEvents = [
      'adsready', 'adserror', 'adscanceled', 'adsload', 'alladsend',
      'adstart', 'adend', 'adskip', 'adtimeout', 'contentupdate',
      'contentresumed', 'contentended', 'streamloaded', 'streamfailed'
    ];

    daiEvents.forEach(event => {
      player.on(event, (e) => {
        this.logEvent(event, `DAI event: ${event}`, 'dai');
      });
    });

    // IMA DAI manager events
    try {
      const adsManager = player.ima.getAdsManager();
      if (adsManager) {
        adsManager.addEventListener(google.ima.AdEvent.Type.LOADED, () => {
          this.logEvent('ima-loaded', 'IMA DAI ad loaded', 'dai');
        });
        
        adsManager.addEventListener(google.ima.AdEvent.Type.STARTED, () => {
          this.logEvent('ima-started', 'IMA DAI ad started', 'dai');
        });
        
        adsManager.addEventListener(google.ima.AdEvent.Type.COMPLETE, () => {
          this.logEvent('ima-complete', 'IMA DAI ad completed', 'dai');
        });

        adsManager.addEventListener(google.ima.AdEvent.Type.FIRST_QUARTILE, () => {
          this.logEvent('ima-quartile', 'IMA DAI ad first quartile', 'dai');
        });

        adsManager.addEventListener(google.ima.AdEvent.Type.MIDPOINT, () => {
          this.logEvent('ima-quartile', 'IMA DAI ad midpoint', 'dai');
        });

        adsManager.addEventListener(google.ima.AdEvent.Type.THIRD_QUARTILE, () => {
          this.logEvent('ima-quartile', 'IMA DAI ad third quartile', 'dai');
        });
      }
    } catch (error) {
      this.logEvent('monitoring-error', `Error setting up IMA event monitoring: ${error.message}`, 'error');
    }

    this.logEvent('monitoring', 'DAI event monitoring setup complete', 'dai');
  }

  /**
   * Setup New Relic tracking event monitoring
   * @param {Object} tracker - New Relic tracker instance (optional)
   */
  setupNewRelicMonitoring(tracker = null) {

    return;
    // Mock New Relic events for demonstration
    setTimeout(() => {
      this.logEvent('tracker-init', 'New Relic tracker initialized', 'newrelic');
    }, 1000);

    // Simulate periodic New Relic events
    setInterval(() => {
      if (Math.random() > 0.7) {
        const events = ['send', 'harvest', 'beacon', 'interaction', 'pageview'];
        const event = events[Math.floor(Math.random() * events.length)];
        this.logEvent(event, `New Relic ${event} event`, 'newrelic');
      }
    }, 5000);

    // If a real tracker is provided, set up actual event monitoring
    if (tracker) {
      // Add real New Relic tracker event listeners here
      this.logEvent('tracker-real', 'Real New Relic tracker monitoring enabled', 'newrelic');
    }

    this.logEvent('monitoring', 'New Relic event monitoring setup complete', 'newrelic');
  }

  /**
   * Clear the event log
   */
  clearLog() {
    if (this.eventLog) {
      this.eventLog.innerHTML = '';
      this.logEvent('clear', 'Event log cleared');
    }
  }

  /**
   * Export event log as text
   * @returns {string} Event log as text
   */
  exportLog() {
    if (!this.eventLog) return '';
    
    const events = Array.from(this.eventLog.children);
    return events.map(event => event.textContent).join('\n');
  }
}

// Export for use in HTML
window.EventMonitor = EventMonitor;
