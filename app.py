from flask import Flask, render_template, request, jsonify
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

app = Flask(__name__)
app.secret_key = os.urandom(24)

import threading

# Email Configuration
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'bharatbyte.com@gmail.com'
app.config['MAIL_PASSWORD'] = 'jcnn jcnp ydlb yoel'

def send_email_thread(subject, recipient, body, is_html=False):
    try:
        msg = MIMEMultipart()
        msg['From'] = f"BharatByteSolutions <{app.config['MAIL_USERNAME']}>"
        msg['To'] = recipient
        msg['Subject'] = subject

        if is_html:
            msg.attach(MIMEText(body, 'html'))
        else:
            msg.attach(MIMEText(body, 'plain'))

        # Clean password (remove spaces if copied from Google)
        password = app.config['MAIL_PASSWORD'].replace(" ", "")

        server = smtplib.SMTP(app.config['MAIL_SERVER'], app.config['MAIL_PORT'])
        server.starttls()
        server.login(app.config['MAIL_USERNAME'], password)
        server.send_message(msg)
        server.quit()
        print(f"Email sent successfully to {recipient}")
    except Exception as e:
        print(f"Failed to send email: {e}")

def send_async_email(subject, recipient, body, is_html=False):
    thread = threading.Thread(target=send_email_thread, args=(subject, recipient, body, is_html))
    thread.start()

# Route for the landing page
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/privacy-policy')
def privacy_policy():
    return render_template('privacy_policy.html')

@app.route('/terms-of-service')
def terms_of_service():
    return render_template('terms_of_service.html')

@app.route('/sw.js')
def sw():
    return app.send_static_file('sw.js')

# API Endpoint for Contact Form
@app.route('/api/contact', methods=['POST'])
def contact():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    message = data.get('message')

    if not all([name, email, message]):
        return jsonify({'status': 'error', 'message': 'All fields are required.'}), 400

    # 1. Send Notification to Admin
    admin_subject = f"New Project Lead - {name}"
    admin_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>New Lead | BharatByteSolutions</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9;">
            <tr>
                <td align="center" style="padding: 40px 20px;">
                    <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        
                        <!-- Header -->
                        <tr>
                            <td style="padding: 20px 30px; background-color: #1e293b; border-bottom: 2px solid #4f46e5;">
                                <h2 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 600;">New Project Lead</h2>
                            </td>
                        </tr>

                        <!-- Body -->
                        <tr>
                            <td style="padding: 30px;">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td style="padding-bottom: 20px;">
                                            <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Client Name</p>
                                            <p style="margin: 5px 0 0 0; font-size: 16px; color: #0f172a; font-weight: 600;">{name}</p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding-bottom: 20px;">
                                            <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Email Address</p>
                                            <p style="margin: 5px 0 0 0; font-size: 16px; color: #4f46e5; text-decoration: none;">{email}</p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Message</p>
                                            <div style="margin-top: 10px; padding: 15px; background-color: #f8fafc; border-left: 3px solid #10b981; border-radius: 4px;">
                                                <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.6;">"{message}"</p>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="padding: 15px 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                                <p style="margin: 0; font-size: 12px; color: #94a3b8;">Sent via BharatByteSolutions Contact Form</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    send_async_email(admin_subject, app.config['MAIL_USERNAME'], admin_body, is_html=True)

    # 2. Send Premium Confirmation to User
    user_subject = f"Inquiry Received | BharatByteSolutions"
    user_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>BharatByteSolutions</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        
        <!-- Outer Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6;">
            <tr>
                <td align="center" style="padding: 40px 20px;">
                    
                    <!-- Main Card -->
                    <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);">
                        
                        <!-- Header with Light Blue Background -->
                        <tr>
                            <td style="padding: 35px 40px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td>
                                            <h1 style="margin: 0; color: #0f172a; font-size: 22px; letter-spacing: -0.5px; font-weight: 800;">BharatByteSolutions<span style="color: #4f46e5;">.</span></h1>
                                        </td>
                                        <td align="right">
                                            <span style="font-size: 12px; color: #64748b; background: #e0e7ff; padding: 4px 10px; border-radius: 20px; font-weight: 600; color: #4338ca;">INQUIRY RECEIVED</span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Body Content -->
                        <tr>
                            <td style="padding: 40px;">
                                <p style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px;">Reference ID: #BBS-{name[:3].upper()}001</p>
                                
                                <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 20px; font-weight: 700;">Hello {name},</h2>
                                
                                <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                                    Thank you for reaching out to BharatByteSolutions. We confirmed receipt of your inquiry and our engineering team is already reviewing the details.
                                </p>

                                <!-- Quote Box -->
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-left: 3px solid #4f46e5; margin-bottom: 24px; border-radius: 0 4px 4px 0;">
                                    <tr>
                                        <td style="padding: 16px 20px;">
                                            <p style="margin: 0; color: #475569; font-style: italic; font-size: 14px; line-height: 1.5;">"{message}"</p>
                                        </td>
                                    </tr>
                                </table>

                                <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
                                    We typically respond within <strong>24 business hours</strong>. In the meantime, feel free to explore our latest case studies.
                                </p>

                                <!-- CTA Button -->
                                <table border="0" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td align="left" style="border-radius: 6px; background: #4f46e5;">
                                            <a href="https://bharatbytesolutions.com" style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
                                                View Our Website &rarr;
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="padding: 30px 40px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0;">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td style="color: #64748b; font-size: 12px; line-height: 1.5;">
                                            &copy; 2026 BharatByteSolutions Inc. All rights reserved.<br>
                                            <span style="display: block; margin-top: 5px;">Gandhinagar, Gujarat</span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                    </table>
                    
                    <!-- Bottom Unsubscribe/Info -->
                    <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 25px; line-height: 1.5;">
                        You received this email because you contacted us via our website.<br>
                        <a href="#" style="color: #94a3b8; text-decoration: underline;">Privacy Policy</a> • <a href="#" style="color: #94a3b8; text-decoration: underline;">Terms of Service</a>
                    </p>

                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    send_async_email(user_subject, email, user_body, is_html=True)
    
    return jsonify({'status': 'success', 'message': 'Message sent! Check your inbox for confirmation.'})

if __name__ == '__main__':
    app.run(debug=True)

