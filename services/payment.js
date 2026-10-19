export const redirectToPayment = (payment) => {
    if (payment.gateway === 'khalti') {
        window.location.assign(payment.paymentUrl);
        return;
    }

    if (payment.gateway !== 'esewa' || !payment.paymentUrl || !payment.fields) {
        throw new Error('The payment gateway returned an invalid checkout response.');
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = payment.paymentUrl;

    Object.entries(payment.fields).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = String(value);
        form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
};
