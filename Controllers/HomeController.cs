using Microsoft.AspNetCore.Mvc;

namespace ParkingApp.Controllers
{
    public class HomeController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
