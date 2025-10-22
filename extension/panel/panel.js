// panel/main.js
import { state } from './state.js';
import { initDomRefs } from './dom.js';
import { dispatchMessage } from './handlers.js';
import { bindUIEvents, subscribeCurrentTab, watchTabChanges } from './events.js';
import { showDetect } from './ui.js';

function initializePayPalButtons() {
    if (typeof paypal === 'undefined') {
        console.error("PayPal SDK not loaded.");
        return;
    }

    paypal.Buttons({

        createOrder: function(data, actions) {
            // This function sets up the details of the transaction, including the amount and line item details.
            // In a real application, this would typically involve a server-side call to create the order.
            return actions.order.create({
                purchase_units: [{
                    amount: {
                        value: '10.00' // Replace with actual amount
                    }
                }]
            });
        },
        onApprove: function(data, actions) {
            // This function captures the funds from the transaction.
            // In a real application, this would typically involve a server-side call to capture the order.
            return actions.order.capture().then(function(details) {
                // Show a success message to the buyer
                alert('Transaction completed by ' + details.payer.name.given_name + '!');
                console.log('Payment successful!', details);
                // Here you would typically update your application's state,
                // e.g., unlock pro features for the user.
            });
        },
        onError: function(err) {
            console.error('An error occurred during the PayPal transaction', err);
            alert('An error occurred during the PayPal transaction. Please try again.');
        }
    }).render('#paypal-button-container'); // Render the PayPal button into the div with id 'paypal-button-container'
}

document.addEventListener('DOMContentLoaded', () => {
    initDomRefs();

    // 포트 연결
    state.port = chrome.runtime.connect({ name: "panel" });
    state.port.onMessage.addListener(dispatchMessage);
    state.port.onDisconnect.addListener(() => {
        console.warn("[PANEL] port disconnected");
    });

    // 초기 UI
    showDetect();

    // 이벤트 바인딩
    bindUIEvents();

    // 탭 추적
    subscribeCurrentTab();
    watchTabChanges();

    // Initialize PayPal buttons
    initializePayPalButtons();
});
