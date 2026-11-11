using Microsoft.Extensions.Logging;
using TeaAuction.Application.Abstractions;

namespace TeaAuction.Infrastructure.Notifications;

public sealed class LoggingEmailSender(ILogger<LoggingEmailSender> logger) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        logger.LogInformation(
            "Email to {To} with subject {Subject}. {Body}",
            message.To,
            message.Subject,
            message.Body);
        return Task.CompletedTask;
    }
}
